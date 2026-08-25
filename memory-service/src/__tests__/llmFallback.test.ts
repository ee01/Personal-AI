import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Config } from '../config.js';
import { LLMClient, LLMAllTargetsFailedError } from '../llm/LLMClient.js';
import {
  parseLLMFallbacks,
  primaryTargetSpec,
  type LLMTargetCredentialContext,
} from '../llm/LLMTarget.js';
import { TargetHealthTracker } from '../llm/TargetHealthTracker.js';
import * as UsageRecorder from '../analytics/UsageRecorder.js';

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
    groqApiKey: 'groq-key',
    difyApiKey: '',
    difyApiUrl: '',
    difyAppMode: 'chat',
    ollamaBaseUrl: 'http://localhost:11434',
    ollamaModel: 'llama3',
    llmRequestTimeoutMs: 30000,
    llmFallbacks: [{ provider: 'groq', model: 'llama-3.3-70b-versatile' }],
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
  } as Config;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function openaiMessage(content: string, model = 'gpt-4o-mini'): Response {
  return jsonResponse(200, {
    model,
    choices: [{ message: { content } }],
    usage: { prompt_tokens: 4, completion_tokens: 2 },
  });
}

function sseResponse(deltas: string[]): Response {
  const encoder = new TextEncoder();
  const chunks = [
    ...deltas.map(
      (delta) =>
        `data: ${JSON.stringify({ choices: [{ delta: { content: delta } }] })}\n\n`,
    ),
    'data: [DONE]\n\n',
  ];
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

const creds: LLMTargetCredentialContext = {
  openaiApiKey: 'sk-test',
  openaiApiBaseUrl: '',
  openaiModel: 'gpt-4o-mini',
  claudeApiKey: '',
  claudeModel: 'claude-sonnet-4-6',
  groqApiKey: 'gsk-test',
  ollamaBaseUrl: 'http://localhost:11434',
  ollamaModel: 'llama3',
  difyApiKey: 'app-test',
  difyApiUrl: 'https://dify.example/v1',
  difyAppMode: 'chat',
};

describe('parseLLMFallbacks', () => {
  it('drops unknown providers and missing credentials with warnings', () => {
    const warnings: string[] = [];
    const primary = primaryTargetSpec('openai', creds);
    const specs = parseLLMFallbacks(
      'not-a-provider/x,groq/llama-3.3-70b-versatile,dify,openai/gpt-4o-mini',
      { ...creds, difyApiKey: '' },
      primary,
      (message) => warnings.push(message),
    );
    expect(specs).toEqual([{ provider: 'groq', model: 'llama-3.3-70b-versatile' }]);
    expect(warnings.some((line) => line.includes('unknown provider'))).toBe(true);
    expect(warnings.some((line) => line.includes('missing credentials'))).toBe(
      true,
    );
    expect(warnings.some((line) => line.includes('duplicate'))).toBe(true);
  });

  it('accepts claude fallbacks when a Claude API key is set', () => {
    const primary = primaryTargetSpec('openai', creds);
    const specs = parseLLMFallbacks(
      'claude/claude-sonnet-4-6',
      { ...creds, claudeApiKey: 'sk-ant-test' },
      primary,
    );
    expect(specs).toEqual([
      { provider: 'claude', model: 'claude-sonnet-4-6' },
    ]);
  });
});

describe('LLMClient fallback', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    vi.spyOn(UsageRecorder, 'recordLlmUsage').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('retries the primary once and throws the original error without fallbacks', async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(jsonResponse(500, { error: 'boom' }));
    const client = new LLMClient(makeConfig({ llmFallbacks: [] }));
    const pending = client.generate('hello');
    const assertion = expect(pending).rejects.toThrow(/500/);
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('fails over to groq after primary 500s and attributes usage to groq', async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(500, { error: 'primary' }))
      .mockResolvedValueOnce(jsonResponse(500, { error: 'primary-retry' }))
      .mockResolvedValueOnce(openaiMessage('from groq', 'llama-3.3-70b-versatile'));

    const client = new LLMClient(makeConfig());
    const pending = client.generate('hello');
    await vi.advanceTimersByTimeAsync(1000);
    const result = await pending;
    expect(result.content).toBe('from groq');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain('api.groq.com');
    const success = vi
      .mocked(UsageRecorder.recordLlmUsage)
      .mock.calls.find((call) => call[0].status !== 'error');
    expect(success?.[0].model).toBe('llama-3.3-70b-versatile');
    expect(success?.[0].provider).toBe('groq');
  });

  it('does not retry the primary on 401 when fallbacks exist', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { error: 'bad key' }))
      .mockResolvedValueOnce(openaiMessage('fallback ok'));

    const client = new LLMClient(makeConfig());
    const result = await client.generate('hello', { retryCount: 1 });
    expect(result.content).toBe('fallback ok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws LLMAllTargetsFailedError when every target fails', async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { error: 'down' }));
    const client = new LLMClient(makeConfig());
    await expect(client.generate('hello', { retryCount: 0 })).rejects.toBeInstanceOf(
      LLMAllTargetsFailedError,
    );
  });

  it('does not fail over after stream bytes have been emitted', async () => {
    const encoder = new TextEncoder();
    let sent = false;
    const stream = new ReadableStream({
      pull(controller) {
        if (!sent) {
          sent = true;
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ choices: [{ delta: { content: 'Hi' } }] })}\n\n`,
            ),
          );
          return;
        }
        controller.error(new Error('stream broken'));
      },
    });
    fetchMock.mockResolvedValueOnce(
      new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    );

    const deltas: string[] = [];
    const client = new LLMClient(makeConfig());
    await expect(
      client.generateStream('hello', undefined, async (delta) => {
        deltas.push(delta);
      }),
    ).rejects.toThrow();
    expect(deltas.join('')).toContain('Hi');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fails over streaming when the primary connection fails before any bytes', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(sseResponse(['ok']));

    const deltas: string[] = [];
    const client = new LLMClient(makeConfig());
    const result = await client.generateStream('hello', undefined, async (delta) => {
      deltas.push(delta);
    });
    expect(result.content).toBe('ok');
    expect(deltas.join('')).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('fails over generateJSON parse errors when the flag is on', async () => {
    fetchMock
      .mockResolvedValueOnce(openaiMessage('not-json'))
      .mockResolvedValueOnce(openaiMessage('{"ok":true}'));

    const client = new LLMClient(
      makeConfig({ llmFallbackOnJsonParse: true }),
    );
    await expect(client.generateJSON<{ ok: boolean }>('hello')).resolves.toEqual({
      ok: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not fail over JSON parse errors when the flag is off', async () => {
    fetchMock.mockResolvedValueOnce(openaiMessage('not-json'));
    const client = new LLMClient(
      makeConfig({ llmFallbackOnJsonParse: false }),
    );
    await expect(client.generateJSON('hello')).rejects.toThrow(/JSON/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('cools down the primary after consecutive failures and tries fallback first', async () => {
    const client = new LLMClient(
      makeConfig({
        llmFallbackFailureThreshold: 3,
        llmFallbackCooldownMs: 60_000,
      }),
    );

    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes('api.groq.com')) {
        return openaiMessage('groq-ok');
      }
      return jsonResponse(500, { error: 'primary' });
    });

    for (let i = 0; i < 3; i += 1) {
      await client.generate('hello', { retryCount: 0 });
    }

    fetchMock.mockClear();
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes('api.groq.com')) {
        return openaiMessage('groq-ok');
      }
      throw new Error('primary should be skipped');
    });

    const result = await client.generate('hello', { retryCount: 0 });
    expect(result.content).toBe('groq-ok');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('api.groq.com');

    const snapshot = client.getTargetHealthSnapshot();
    const primary = snapshot.find((row) => row.id.startsWith('openai/'));
    expect(primary?.healthy).toBe(false);
    expect(primary?.consecutiveFailures).toBeGreaterThanOrEqual(3);
  });
});

describe('TargetHealthTracker', () => {
  it('uses a longer cooldown for auth failures', () => {
    const tracker = new TargetHealthTracker(3, 1_000, true);
    tracker.recordFailure('openai/gpt-4o-mini', 'auth', 10_000);
    expect(tracker.isInCooldown('openai/gpt-4o-mini', 10_500)).toBe(true);
    expect(tracker.isInCooldown('openai/gpt-4o-mini', 20_000)).toBe(false);
  });
});
