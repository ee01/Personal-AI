import fs from 'node:fs';
import path from 'node:path';

import BetterSqlite3 from 'better-sqlite3';

import { SourceMemoryRecallSignalBackfillService } from '../core/SourceMemoryRecallSignalBackfillService.js';

interface CliOptions {
  dbPath: string;
  sourceMemoryDir: string;
  apply: boolean;
  expectedTargets?: number;
  runId?: string;
  includeTargetIds: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    dbPath: '',
    sourceMemoryDir: '',
    apply: false,
    includeTargetIds: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === '--db-path' && next) {
      options.dbPath = path.resolve(next);
      index += 1;
    } else if (arg === '--source-memory-dir' && next) {
      options.sourceMemoryDir = path.resolve(next);
      index += 1;
    } else if (arg === '--expected-targets' && next) {
      options.expectedTargets = Number(next);
      index += 1;
    } else if (arg === '--run-id' && next) {
      options.runId = next;
      index += 1;
    } else if (arg === '--apply') {
      options.apply = true;
    } else if (arg === '--include-target-ids') {
      options.includeTargetIds = true;
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }

  if (!options.dbPath || !fs.existsSync(options.dbPath)) {
    throw new Error('--db-path must point to an existing SQLite database.');
  }
  if (!options.sourceMemoryDir || !fs.statSync(options.sourceMemoryDir).isDirectory()) {
    throw new Error('--source-memory-dir must point to the snapshot directory.');
  }
  if (
    options.expectedTargets !== undefined &&
    (!Number.isInteger(options.expectedTargets) || options.expectedTargets < 0)
  ) {
    throw new Error('--expected-targets must be a non-negative integer.');
  }
  return options;
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const db = new BetterSqlite3(options.dbPath);
  try {
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 15000');
    if (!options.apply) {
      db.pragma('query_only = ON');
    }
    const service = new SourceMemoryRecallSignalBackfillService(
      db,
      options.sourceMemoryDir,
    );
    const result = service.run({
      apply: options.apply,
      expectedTargets: options.expectedTargets,
      runId: options.runId,
      includeTargetIds: options.includeTargetIds,
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    db.close();
  }
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Source Memory recall-signal backfill failed: ${message}\n`);
  process.exitCode = 1;
}
