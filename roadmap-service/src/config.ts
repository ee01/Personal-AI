import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const config = {
  port: Number(process.env.PORT) || 3220,
  host: process.env.HOST || '0.0.0.0',
  dataDir: process.env.DATA_DIR || path.resolve(__dirname, '../data'),
  softLockTtlMs: Number(process.env.SOFT_LOCK_TTL_MS) || 30_000,
  activityRetentionDays: Number(process.env.ACTIVITY_RETENTION_DAYS) || 90,
};
