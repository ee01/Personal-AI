/**
 * Shared minimal Config fixture for LLMClient tests (P0b budget guard etc.).
 * Kept side-effect free so multiple test files can import it without
 * touching process.env or reading the real .env.
 */

import type { Config } from '../config.js';

export function makeTestConfig(overrides: Partial<Config> = {}): Config {
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
  } as unknown as Config;
}
