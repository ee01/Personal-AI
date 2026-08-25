/**
 * Check and repair the usage-analytics database (${DATA_DIR}/analytics/usage.db).
 *
 * This DB holds only derived telemetry, but it is the highest-churn file in the
 * service, so a torn page on a bind-mounted volume takes the whole usage report
 * down with SQLITE_CORRUPT. Salvage keeps whatever `sqlite3 .recover` can read.
 *
 * Deliberately dependency-free (node + the sqlite3 CLI only) so it runs on a
 * deploy host that has no node_modules and no tsx. Stop memory-service first;
 * the original file is always copied into `analytics/quarantine/`.
 *
 * Usage:
 *   node memory-service/tools/repair-analytics-db.mjs [dbPath]
 *   node memory-service/tools/repair-analytics-db.mjs --reset    # discard history
 *   node memory-service/tools/repair-analytics-db.mjs --vacuum   # compact a healthy DB
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serviceRoot = path.resolve(__dirname, '..');

function defaultDbPath() {
  const raw = process.env.DATA_DIR || './data';
  const dataDir = path.isAbsolute(raw) ? raw : path.resolve(serviceRoot, raw);
  return path.join(dataDir, 'analytics', 'usage.db');
}

function parseArgs(argv) {
  const options = { dbPath: defaultDbPath(), reset: false, vacuum: false };
  for (const arg of argv) {
    if (arg === '--reset') options.reset = true;
    else if (arg === '--vacuum') options.vacuum = true;
    else if (arg.startsWith('--')) throw new Error(`Unknown argument: ${arg}`);
    else options.dbPath = path.resolve(arg);
  }
  return options;
}

/** SQL goes in on stdin so comment lines are never parsed as CLI options. */
function sqlite(dbPath, sql, { readonly = true } = {}) {
  const args = readonly ? ['-readonly', dbPath] : [dbPath];
  const result = spawnSync('sqlite3', args, { encoding: 'utf-8', input: sql });
  if (result.error) throw result.error;
  return {
    status: result.status,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
  };
}

/**
 * Read a value with `-readonly` when possible. A WAL database whose `-shm` file
 * is gone (the normal state after a clean shutdown) cannot be opened read-only,
 * and that must not be mistaken for corruption, so fall back to a normal open.
 */
function readQuery(dbPath, sql) {
  const readonly = sqlite(dbPath, sql, { readonly: true });
  if (readonly.status === 0) return readonly;
  if (/unable to open database file/i.test(readonly.stderr + readonly.stdout)) {
    return sqlite(dbPath, sql, { readonly: false });
  }
  return readonly;
}

function requireSqliteCli() {
  const probe = spawnSync('sqlite3', ['--version'], { stdio: 'ignore' });
  if (probe.status !== 0) {
    throw new Error('The sqlite3 CLI is required but was not found on PATH.');
  }
}

/** Returns null when the file passes quick_check, otherwise the failure text. */
function quickCheck(dbPath) {
  const { status, stdout, stderr } = readQuery(dbPath, 'PRAGMA quick_check(10);');
  if (status !== 0) return stderr || stdout || `sqlite3 exited ${status}`;
  return stdout === 'ok' ? null : stdout;
}

function rowCounts(dbPath) {
  const counts = {};
  for (const table of ['usage_events', 'api_call_events', 'usage_rollup_daily']) {
    const { status, stdout, stderr } = readQuery(
      dbPath,
      `SELECT COUNT(*) FROM ${table};`,
    );
    counts[table] = status === 0 ? Number(stdout) : `unreadable (${stderr})`;
  }
  return counts;
}

function quarantine(dbPath, stamp) {
  const dir = path.join(path.dirname(dbPath), 'quarantine');
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, `usage-${stamp}.db`);
  fs.copyFileSync(dbPath, target);
  for (const suffix of ['-wal', '-shm']) {
    if (fs.existsSync(dbPath + suffix)) {
      fs.copyFileSync(dbPath + suffix, target + suffix);
    }
  }
  return target;
}

function shellQuote(value) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function salvage(dbPath, recoveredPath) {
  fs.rmSync(recoveredPath, { force: true });
  const result = spawnSync(
    'sh',
    [
      '-c',
      `sqlite3 ${shellQuote(dbPath)} '.recover' | sqlite3 ${shellQuote(recoveredPath)}`,
    ],
    { stdio: ['ignore', 'inherit', 'inherit'] },
  );
  if (result.status !== 0) {
    throw new Error(`sqlite3 .recover failed with status ${result.status}`);
  }
}

function freshDatabase(dbPath) {
  const schema = fs.readFileSync(
    path.join(serviceRoot, 'src', 'analytics', 'schema.sql'),
    'utf-8',
  );
  const { status, stderr } = sqlite(dbPath, schema, { readonly: false });
  if (status !== 0) {
    throw new Error(`Failed to create a fresh analytics DB: ${stderr}`);
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const { dbPath } = options;
  requireSqliteCli();

  if (!fs.existsSync(dbPath)) {
    console.log(`[repair-analytics] No database at ${dbPath}; nothing to do.`);
    return;
  }

  console.log(`[repair-analytics] Target: ${dbPath}`);
  const problem = quickCheck(dbPath);
  if (!problem && !options.reset) {
    console.log('[repair-analytics] quick_check: ok');
    console.log('[repair-analytics] Rows:', rowCounts(dbPath));
    if (options.vacuum) {
      const { status, stderr } = sqlite(dbPath, 'VACUUM;', { readonly: false });
      if (status !== 0) throw new Error(`VACUUM failed: ${stderr}`);
      console.log('[repair-analytics] VACUUM done.');
    }
    return;
  }
  if (problem) {
    console.error(`[repair-analytics] quick_check failed: ${problem}`);
  }

  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '-')
    .slice(0, 15);
  console.log(`[repair-analytics] Backed up to ${quarantine(dbPath, stamp)}`);

  const recoveredPath = `${dbPath}.recovered`;
  if (options.reset) {
    console.log('[repair-analytics] --reset: starting an empty analytics DB.');
    fs.rmSync(recoveredPath, { force: true });
    freshDatabase(recoveredPath);
  } else {
    console.log('[repair-analytics] Salvaging with sqlite3 .recover ...');
    salvage(dbPath, recoveredPath);
    const recoveredProblem = quickCheck(recoveredPath);
    if (recoveredProblem) {
      throw new Error(
        `Recovered file still fails quick_check: ${recoveredProblem}`,
      );
    }
    console.log('[repair-analytics] Recovered rows:', rowCounts(recoveredPath));
  }

  for (const suffix of ['', '-wal', '-shm']) {
    fs.rmSync(dbPath + suffix, { force: true });
  }
  fs.renameSync(recoveredPath, dbPath);
  console.log('[repair-analytics] Done. Restart memory-service.');
}

main();
