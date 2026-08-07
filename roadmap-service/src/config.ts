import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const jiraBaseUrl = (process.env.JIRA_BASE_URL || '').trim();
const jiraPat = (process.env.JIRA_PAT || '').trim();

export const config = {
  port: Number(process.env.PORT) || 3220,
  host: process.env.HOST || '0.0.0.0',
  dataDir: process.env.DATA_DIR || path.resolve(__dirname, '../data'),
  softLockTtlMs: Number(process.env.SOFT_LOCK_TTL_MS) || 30_000,
  activityRetentionDays: Number(process.env.ACTIVITY_RETENTION_DAYS) || 90,
  jira: {
    baseUrl: jiraBaseUrl,
    pat: jiraPat,
    fieldTargetStart:
      process.env.JIRA_FIELD_TARGET_START || 'customfield_18350',
    fieldTargetEnd: process.env.JIRA_FIELD_TARGET_END || 'customfield_18351',
    enabled: Boolean(jiraBaseUrl && jiraPat),
  },
};
