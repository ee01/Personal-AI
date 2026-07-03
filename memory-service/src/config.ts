import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

export interface Config {
  // Server
  port: number;
  host: string;
  dataDir: string;
  logLevel: string;
  sqliteJournalMode: SqliteJournalMode;
  sqliteSynchronous: SqliteSynchronousMode;

  // LLM
  llmProvider: string;
  openaiApiKey: string;
  openaiApiBaseUrl: string;
  openaiModel: string;
  groqApiKey: string;
  difyApiKey: string;
  difyApiUrl: string;
  difyAppMode: 'chat' | 'completion';
  ollamaBaseUrl: string;
  ollamaModel: string;
  llmRequestTimeoutMs: number;

  // Embedding
  embeddingProvider: string;
  embeddingModel: string;
  embeddingDimension: number;

  // Auth
  apiKey: string;

  // Bot
  botApiBaseUrl: string;
  botToken: string;
  botId: string;
  botType: string;
  botTeamId: string;
  botTargetEmail: string;

  // Context Match
  contextMatchThreshold: number;

  // Scheduler
  proactiveSchedulerEnabled: boolean;
  heartbeatIntervalMs: number;
  dailyCron: string;
  weeklyCron: string;
  quietHoursStart: number;
  quietHoursEnd: number;
  todayPilotPrepCron: string;
  todayPilotTimezone: string;
  todayPilotMeetingPrepMax: number;
  todayPilotMeetingPrepEnabled: boolean;
  composeAssistEnabled: boolean;

  // Recent Focus injection (QW-1): standard "近期重点" block injected into
  // /ask and quick-ask system prompts, sharing logic with the Doubao digest.
  recentFocusEnabled: boolean;
  recentFocusWindowDays: number;
  recentFocusTokenBudget: number;

  // Progressive (L0/L1/L2) evidence assembly under a token budget (QW-3).
  evidenceProgressiveEnabled: boolean;
  evidenceFullCount: number;
  evidenceTokenBudget: number;

  // Graph recall algorithm (P0-3): 'ppr' (Personalized PageRank, associative)
  // or 'hops' (legacy 1-2 hop walk).
  recallGraphAlgorithm: 'ppr' | 'hops';
  recallGraphPprMaxNodes: number;
  recallGraphPprMaxHops: number;

  // Behavioral intimacy factor in recall ranking (P0-4).
  recallAffinityEnabled: boolean;
  recallAffinityWeight: number;
  affinityWindowDays: number;
  // Behavioral intimacy in ingest salience scoring (P0-4 P1). Only the positive
  // side feeds intake (negative affinity never blocks storage — forgetting is the
  // ForgettingEngine's job).
  salienceAffinityEnabled: boolean;
  salienceAffinityWeight: number;
  // Chunk-level merge decision ADD/UPDATE/MERGE/NOOP (P1-6 slice A). Default off.
  chunkMergeDecisionEnabled: boolean;

  // Weekly Report
  weeklyReportEnabled: boolean;
  weeklyReportCron: string;
  weeklyReportMinMessages: number;

  // Dream Digest
  dreamDigestEnabled: boolean;
  dreamDigestScheduleType: 'weekly' | 'every_x_days' | 'monthly';
  dreamDigestIntervalDays: number;

  // Reflection runtime
  reflectionEnabled: boolean;
  reflectionActiveTopicLimit: number;
  reflectionHeartbeatMinutes: number;
  reflectionUrgentNotifyThreshold: number;
  reflectionAutoExecuteThreshold: number;
  reflectionUrgentConfidenceThreshold: number;

  // OpenClaw
  openClawEnabled: boolean;
  openClawBaseUrl: string;
  openClawApiKey: string;
  openClawTimeoutMs: number;

  // Outreach
  outreachEnabled: boolean;
  outreachIntervalMs: number;
  outreachRequireApprovalForReflection: boolean;
  outreachRequireApprovalForManual: boolean;
  outreachBeforeDispatchTargetChannelLookbackSeconds: number;
  outreachBeforeDispatchGlobalMemoryLookbackSeconds: number;
  ringCentralServerUrl: string;
  ringCentralClientId: string;
  ringCentralClientSecret: string;
  ringCentralJwt: string;
}

export type SqliteJournalMode =
  | 'DELETE'
  | 'TRUNCATE'
  | 'PERSIST'
  | 'MEMORY'
  | 'WAL'
  | 'OFF';

export type SqliteSynchronousMode = 'OFF' | 'NORMAL' | 'FULL' | 'EXTRA';

let _config: Readonly<Config> | null = null;

function parseSqliteJournalMode(raw: string | undefined): SqliteJournalMode {
  const normalized = (raw || 'WAL').trim().toUpperCase();
  if (
    normalized === 'DELETE' ||
    normalized === 'TRUNCATE' ||
    normalized === 'PERSIST' ||
    normalized === 'MEMORY' ||
    normalized === 'WAL' ||
    normalized === 'OFF'
  ) {
    return normalized;
  }
  return 'WAL';
}

function parseSqliteSynchronousMode(
  raw: string | undefined,
): SqliteSynchronousMode {
  const normalized = (raw || 'NORMAL').trim().toUpperCase();
  if (
    normalized === 'OFF' ||
    normalized === 'NORMAL' ||
    normalized === 'FULL' ||
    normalized === 'EXTRA'
  ) {
    return normalized;
  }
  return 'NORMAL';
}

export function getConfig(): Readonly<Config> {
  if (_config) {
    return _config;
  }

  const rawDataDir = process.env.DATA_DIR;
  const dataDir = rawDataDir
    ? path.isAbsolute(rawDataDir)
      ? rawDataDir
      : path.resolve(__dirname, '..', rawDataDir)
    : path.resolve(__dirname, '..', 'data');
  const rawDreamDigestScheduleType =
    process.env.DREAM_DIGEST_SCHEDULE_TYPE || 'weekly';
  const dreamDigestScheduleType: 'weekly' | 'every_x_days' | 'monthly' =
    rawDreamDigestScheduleType === 'every_x_days' ||
    rawDreamDigestScheduleType === 'monthly'
      ? rawDreamDigestScheduleType
      : 'weekly';
  const parsedDreamIntervalDays = parseInt(
    process.env.DREAM_DIGEST_INTERVAL_DAYS || '7',
    10,
  );
  const dreamDigestIntervalDays = Number.isFinite(parsedDreamIntervalDays)
    ? Math.max(1, parsedDreamIntervalDays)
    : 7;
  const parsedLlmRequestTimeoutMs = parseInt(
    process.env.LLM_REQUEST_TIMEOUT_MS || '60000',
    10,
  );
  const llmRequestTimeoutMs = Number.isFinite(parsedLlmRequestTimeoutMs)
    ? Math.max(1000, parsedLlmRequestTimeoutMs)
    : 60000;

  const config: Config = {
    // Server
    port: parseInt(process.env.PORT || '3210', 10),
    host: process.env.HOST || '0.0.0.0',
    dataDir,
    logLevel: process.env.LOG_LEVEL || 'info',
    sqliteJournalMode: parseSqliteJournalMode(process.env.SQLITE_JOURNAL_MODE),
    sqliteSynchronous: parseSqliteSynchronousMode(
      process.env.SQLITE_SYNCHRONOUS,
    ),

    // LLM
    llmProvider: process.env.LLM_PROVIDER || 'openai',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    openaiApiBaseUrl: process.env.OPENAI_API_BASE_URL || '',
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    groqApiKey: process.env.GROQ_API_KEY || '',
    difyApiKey: process.env.DIFY_API_KEY || '',
    difyApiUrl: process.env.DIFY_API_URL || process.env.DIFY_API_BASE_URL || '',
    difyAppMode: (process.env.DIFY_APP_MODE === 'completion'
      ? 'completion'
      : 'chat') as 'chat' | 'completion',
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    ollamaModel: process.env.OLLAMA_MODEL || 'llama3',
    llmRequestTimeoutMs,

    // Embedding
    embeddingProvider: process.env.EMBEDDING_PROVIDER || 'local',
    embeddingModel: process.env.EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2',
    embeddingDimension: parseInt(process.env.EMBEDDING_DIMENSION || '384', 10),

    // Auth
    apiKey: process.env.API_KEY || '',

    // Bot
    botApiBaseUrl: process.env.BOT_API_BASE_URL || '',
    botToken: process.env.BOT_TOKEN || '',
    botId: process.env.BOT_ID || '',
    botType: process.env.BOT_TYPE || 'user',
    botTeamId: process.env.BOT_TEAM_ID || '',
    botTargetEmail: process.env.BOT_TARGET_EMAIL || '',

    // Context Match (0.50: MiniLM 在混合语言下相似度偏低，0.78 过于严格)
    contextMatchThreshold: parseFloat(
      process.env.CONTEXT_MATCH_THRESHOLD || '0.50',
    ),

    // Scheduler
    proactiveSchedulerEnabled:
      process.env.PROACTIVE_SCHEDULER_ENABLED === 'true' ||
      process.env.PROACTIVE_BACKGROUND_ENABLED === 'true',
    heartbeatIntervalMs: parseInt(
      process.env.HEARTBEAT_INTERVAL_MS || '900000',
      10,
    ),
    dailyCron: process.env.DAILY_CRON || '0 23 * * *',
    weeklyCron: process.env.WEEKLY_CRON || '0 3 * * 0',
    quietHoursStart: parseInt(process.env.QUIET_HOURS_START || '22', 10),
    quietHoursEnd: parseInt(process.env.QUIET_HOURS_END || '8', 10),
    todayPilotPrepCron: process.env.TODAY_PILOT_PREP_CRON || '30 6 * * *',
    todayPilotTimezone:
      process.env.TODAY_PILOT_TIMEZONE ||
      process.env.TIMEZONE ||
      'Asia/Shanghai',
    todayPilotMeetingPrepMax: Math.max(
      1,
      parseInt(process.env.TODAY_PILOT_MEETING_PREP_MAX || '5', 10),
    ),
    todayPilotMeetingPrepEnabled:
      process.env.TODAY_PILOT_MEETING_PREP_ENABLED !== 'false' &&
      process.env.MEETING_PREP_ENABLED !== 'false',
    composeAssistEnabled:
      process.env.COMPOSE_ASSIST_ENABLED !== 'false' &&
      process.env.CONTEXT_ASSIST_ENABLED !== 'false',

    // Recent Focus injection (QW-1): default on; cheap rolling block.
    recentFocusEnabled: process.env.RECENT_FOCUS_ENABLED !== 'false',
    recentFocusWindowDays: (() => {
      const parsed = parseInt(process.env.RECENT_FOCUS_WINDOW_DAYS || '14', 10);
      return Number.isFinite(parsed) ? Math.max(1, parsed) : 14;
    })(),
    recentFocusTokenBudget: (() => {
      const parsed = parseInt(process.env.RECENT_FOCUS_TOKEN_BUDGET || '320', 10);
      return Number.isFinite(parsed) ? Math.max(80, parsed) : 320;
    })(),

    // Progressive evidence assembly (QW-3): default on.
    evidenceProgressiveEnabled: process.env.EVIDENCE_PROGRESSIVE_ENABLED !== 'false',
    evidenceFullCount: (() => {
      const parsed = parseInt(process.env.EVIDENCE_FULL_COUNT || '4', 10);
      return Number.isFinite(parsed) ? Math.max(1, parsed) : 4;
    })(),
    evidenceTokenBudget: (() => {
      const parsed = parseInt(process.env.EVIDENCE_TOKEN_BUDGET || '1200', 10);
      return Number.isFinite(parsed) ? Math.max(200, parsed) : 1200;
    })(),

    // Graph recall algorithm (P0-3): PPR on by default; revert with
    // RECALL_GRAPH_ALGORITHM=hops.
    recallGraphAlgorithm:
      process.env.RECALL_GRAPH_ALGORITHM === 'hops' ? 'hops' : 'ppr',
    recallGraphPprMaxNodes: (() => {
      const parsed = parseInt(process.env.RECALL_GRAPH_PPR_MAX_NODES || '2000', 10);
      return Number.isFinite(parsed) ? Math.max(50, parsed) : 2000;
    })(),
    recallGraphPprMaxHops: (() => {
      const parsed = parseInt(process.env.RECALL_GRAPH_PPR_MAX_HOPS || '3', 10);
      return Number.isFinite(parsed) ? Math.max(1, Math.min(5, parsed)) : 3;
    })(),

    // Behavioral intimacy (P0-4): default on; affinity is 0 until rolled up, so
    // enabling it is a no-op until there is behavior data.
    recallAffinityEnabled: process.env.RECALL_AFFINITY_ENABLED !== 'false',
    recallAffinityWeight: (() => {
      const parsed = parseFloat(process.env.RECALL_AFFINITY_WEIGHT || '0.08');
      return Number.isFinite(parsed) ? Math.max(0, Math.min(0.5, parsed)) : 0.08;
    })(),
    affinityWindowDays: (() => {
      const parsed = parseInt(process.env.AFFINITY_WINDOW_DAYS || '90', 10);
      return Number.isFinite(parsed) ? Math.max(7, parsed) : 90;
    })(),
    // P0-4 P1: ingest-side salience affinity. Default on; entity affinity is 0
    // until rolled up, so enabling it is a no-op until there is behavior data.
    salienceAffinityEnabled: process.env.SALIENCE_AFFINITY_ENABLED !== 'false',
    salienceAffinityWeight: (() => {
      const parsed = parseFloat(process.env.SALIENCE_AFFINITY_WEIGHT || '0.10');
      return Number.isFinite(parsed) ? Math.max(0, Math.min(0.5, parsed)) : 0.10;
    })(),
    // P1-6 slice A: chunk merge decision. Default OFF — adds embedding + LLM call
    // to the write path; enable after the memory-abilities benchmark validates it.
    chunkMergeDecisionEnabled: process.env.CHUNK_MERGE_DECISION_ENABLED === 'true',

    // Weekly Report
    weeklyReportEnabled: process.env.WEEKLY_REPORT_ENABLED !== 'false',
    weeklyReportCron: process.env.WEEKLY_REPORT_CRON || '0 18 * * 5',
    weeklyReportMinMessages: parseInt(
      process.env.WEEKLY_REPORT_MIN_MESSAGES || '20',
      10,
    ),

    // Dream Digest
    dreamDigestEnabled: process.env.DREAM_DIGEST_ENABLED !== 'false',
    dreamDigestScheduleType,
    dreamDigestIntervalDays,

    // Reflection runtime
    reflectionEnabled: process.env.REFLECTION_ENABLED !== 'false',
    reflectionActiveTopicLimit: parseInt(
      process.env.REFLECTION_ACTIVE_TOPIC_LIMIT || '6',
      10,
    ),
    reflectionHeartbeatMinutes: parseInt(
      process.env.REFLECTION_HEARTBEAT_MINUTES || '15',
      10,
    ),
    reflectionUrgentNotifyThreshold: parseFloat(
      process.env.REFLECTION_URGENT_NOTIFY_THRESHOLD || '0.88',
    ),
    reflectionAutoExecuteThreshold: parseFloat(
      process.env.REFLECTION_AUTO_EXECUTE_THRESHOLD || '0.8',
    ),
    reflectionUrgentConfidenceThreshold: parseFloat(
      process.env.REFLECTION_URGENT_CONFIDENCE_THRESHOLD || '0.9',
    ),

    // OpenClaw
    openClawEnabled: process.env.OPENCLAW_ENABLED === 'true',
    openClawBaseUrl: process.env.OPENCLAW_BASE_URL || '',
    openClawApiKey: process.env.OPENCLAW_API_KEY || '',
    openClawTimeoutMs: Math.max(
      300000,
      parseInt(process.env.OPENCLAW_TIMEOUT_MS || '600000', 10),
    ),

    // Outreach
    outreachEnabled: process.env.OUTREACH_ENABLED === 'true',
    outreachIntervalMs: parseInt(
      process.env.OUTREACH_INTERVAL_MS || '60000',
      10,
    ),
    outreachRequireApprovalForReflection:
      process.env.OUTREACH_REQUIRE_APPROVAL_FOR_REFLECTION !== 'false',
    outreachRequireApprovalForManual:
      process.env.OUTREACH_REQUIRE_APPROVAL_FOR_MANUAL === 'true',
    outreachBeforeDispatchTargetChannelLookbackSeconds: Math.max(
      60,
      parseInt(
        process.env.OUTREACH_BEFORE_DISPATCH_TARGET_CHANNEL_LOOKBACK_SECONDS ||
          `${7 * 24 * 60 * 60}`,
        10,
      ),
    ),
    outreachBeforeDispatchGlobalMemoryLookbackSeconds: Math.max(
      60,
      parseInt(
        process.env.OUTREACH_BEFORE_DISPATCH_GLOBAL_MEMORY_LOOKBACK_SECONDS ||
          `${3 * 24 * 60 * 60}`,
        10,
      ),
    ),
    ringCentralServerUrl: process.env.RINGCENTRAL_SERVER_URL || '',
    ringCentralClientId: process.env.RINGCENTRAL_CLIENT_ID || '',
    ringCentralClientSecret: process.env.RINGCENTRAL_CLIENT_SECRET || '',
    ringCentralJwt: process.env.RINGCENTRAL_JWT || '',
  };

  _config = Object.freeze(config);
  return _config;
}
