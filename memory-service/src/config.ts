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

  // LLM
  llmProvider: string;
  openaiApiKey: string;
  openaiModel: string;
  groqApiKey: string;
  difyApiKey: string;
  difyApiUrl: string;
  difyAppMode: 'chat' | 'completion';
  ollamaBaseUrl: string;
  ollamaModel: string;

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
  heartbeatIntervalMs: number;
  dailyCron: string;
  weeklyCron: string;
  quietHoursStart: number;
  quietHoursEnd: number;

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
  ringCentralServerUrl: string;
  ringCentralClientId: string;
  ringCentralClientSecret: string;
  ringCentralJwt: string;
}

let _config: Readonly<Config> | null = null;

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
  const rawDreamDigestScheduleType = process.env.DREAM_DIGEST_SCHEDULE_TYPE || 'weekly';
  const dreamDigestScheduleType: 'weekly' | 'every_x_days' | 'monthly' =
    rawDreamDigestScheduleType === 'every_x_days' || rawDreamDigestScheduleType === 'monthly'
      ? rawDreamDigestScheduleType
      : 'weekly';
  const parsedDreamIntervalDays = parseInt(process.env.DREAM_DIGEST_INTERVAL_DAYS || '7', 10);
  const dreamDigestIntervalDays = Number.isFinite(parsedDreamIntervalDays)
    ? Math.max(1, parsedDreamIntervalDays)
    : 7;

  const config: Config = {
    // Server
    port: parseInt(process.env.PORT || '3210', 10),
    host: process.env.HOST || '0.0.0.0',
    dataDir,
    logLevel: process.env.LOG_LEVEL || 'info',

    // LLM
    llmProvider: process.env.LLM_PROVIDER || 'openai',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    groqApiKey: process.env.GROQ_API_KEY || '',
    difyApiKey: process.env.DIFY_API_KEY || '',
    difyApiUrl: process.env.DIFY_API_URL || process.env.DIFY_API_BASE_URL || '',
    difyAppMode: (process.env.DIFY_APP_MODE === 'completion' ? 'completion' : 'chat') as 'chat' | 'completion',
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    ollamaModel: process.env.OLLAMA_MODEL || 'llama3',

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
    contextMatchThreshold: parseFloat(process.env.CONTEXT_MATCH_THRESHOLD || '0.50'),

    // Scheduler
    heartbeatIntervalMs: parseInt(process.env.HEARTBEAT_INTERVAL_MS || '900000', 10),
    dailyCron: process.env.DAILY_CRON || '0 23 * * *',
    weeklyCron: process.env.WEEKLY_CRON || '0 3 * * 0',
    quietHoursStart: parseInt(process.env.QUIET_HOURS_START || '22', 10),
    quietHoursEnd: parseInt(process.env.QUIET_HOURS_END || '8', 10),

    // Weekly Report
    weeklyReportEnabled: process.env.WEEKLY_REPORT_ENABLED !== 'false',
    weeklyReportCron: process.env.WEEKLY_REPORT_CRON || '0 18 * * 5',
    weeklyReportMinMessages: parseInt(process.env.WEEKLY_REPORT_MIN_MESSAGES || '20', 10),

    // Dream Digest
    dreamDigestEnabled: process.env.DREAM_DIGEST_ENABLED !== 'false',
    dreamDigestScheduleType,
    dreamDigestIntervalDays,

    // Reflection runtime
    reflectionEnabled: process.env.REFLECTION_ENABLED === 'true',
    reflectionActiveTopicLimit: parseInt(process.env.REFLECTION_ACTIVE_TOPIC_LIMIT || '6', 10),
    reflectionHeartbeatMinutes: parseInt(process.env.REFLECTION_HEARTBEAT_MINUTES || '15', 10),
    reflectionUrgentNotifyThreshold: parseFloat(process.env.REFLECTION_URGENT_NOTIFY_THRESHOLD || '0.88'),
    reflectionAutoExecuteThreshold: parseFloat(process.env.REFLECTION_AUTO_EXECUTE_THRESHOLD || '0.8'),
    reflectionUrgentConfidenceThreshold: parseFloat(process.env.REFLECTION_URGENT_CONFIDENCE_THRESHOLD || '0.9'),

    // OpenClaw
    openClawEnabled: process.env.OPENCLAW_ENABLED === 'true',
    openClawBaseUrl: process.env.OPENCLAW_BASE_URL || '',
    openClawApiKey: process.env.OPENCLAW_API_KEY || '',
    openClawTimeoutMs: parseInt(process.env.OPENCLAW_TIMEOUT_MS || '600000', 10),

    // Outreach
    outreachEnabled: process.env.OUTREACH_ENABLED === 'true',
    outreachIntervalMs: parseInt(process.env.OUTREACH_INTERVAL_MS || '60000', 10),
    outreachRequireApprovalForReflection:
      process.env.OUTREACH_REQUIRE_APPROVAL_FOR_REFLECTION !== 'false',
    outreachRequireApprovalForManual:
      process.env.OUTREACH_REQUIRE_APPROVAL_FOR_MANUAL === 'true',
    ringCentralServerUrl: process.env.RINGCENTRAL_SERVER_URL || '',
    ringCentralClientId: process.env.RINGCENTRAL_CLIENT_ID || '',
    ringCentralClientSecret: process.env.RINGCENTRAL_CLIENT_SECRET || '',
    ringCentralJwt: process.env.RINGCENTRAL_JWT || '',
  };

  _config = Object.freeze(config);
  return _config;
}
