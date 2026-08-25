/**
 * List and remove test/e2e user directories under ${DATA_DIR}/users/.
 *
 * Why: the proactive scheduler enumerates every users/<id> directory and runs
 * heartbeat / keystone-composer / daily / weekly LLM loops against all of
 * them, so abandoned test accounts keep burning LLM tokens forever
 * (e.g. webpage-memory-e2e recorded 0.82M tokens in one week with zero
 * foreground API calls).
 *
 * Safety model:
 *  - Dry-run by default: prints the matched candidates and does nothing.
 *  - `--apply` MOVES matched directories into ${DATA_DIR}/deleted-users/<ts>/
 *    instead of deleting them, so a mistake is reversible; purge that folder
 *    manually once you are sure.
 *  - Analytics history (analytics/usage.db) is keyed by userId strings in a
 *    separate DB and is never touched — reports keep their history.
 *  - Tier-2 pak keys live inside each user's own DB, so moving the directory
 *    also revokes them. A client that still sends the removed X-User-Id with
 *    the tier-1 service key will transparently recreate an empty directory.
 *
 * Deliberately dependency-free; run it on the deploy host (or inside the
 * container) where DATA_DIR lives. Stopping memory-service first is
 * recommended but not required: the scheduler re-scans directories each
 * cycle, and already-open SQLite handles for moved users just go stale.
 *
 * Usage:
 *   node memory-service/tools/cleanup-test-users.mjs                 # dry-run
 *   node memory-service/tools/cleanup-test-users.mjs --apply         # move matches
 *   node memory-service/tools/cleanup-test-users.mjs --data-dir /srv/data
 *   node memory-service/tools/cleanup-test-users.mjs --match extra-user --apply
 *
 * Default match list (exact names or prefixes) targets known test accounts:
 *   webpage-memory-e2e, ai-bear-selftest, codex.* / codex-*,
 *   current.user, default, test-*, e2e-*
 * Real users are never matched implicitly; add one-off ids with --match.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serviceRoot = path.resolve(__dirname, '..');

const DEFAULT_EXACT = new Set([
  'webpage-memory-e2e',
  'ai-bear-selftest',
  'codex-null-sync-probe',
  'codex-web-analysis-live-eval',
  'current.user',
  'default',
]);
const DEFAULT_PREFIXES = ['codex.', 'codex-', 'test-', 'e2e-'];

function parseArgs(argv) {
  const args = { apply: false, dataDir: null, extraMatches: [] };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--apply') args.apply = true;
    else if (arg === '--data-dir') args.dataDir = argv[++i];
    else if (arg === '--match') args.extraMatches.push(argv[++i]);
    else if (arg === '--help' || arg === '-h') {
      console.log('See the header comment of this file for usage.');
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }
  return args;
}

function resolveDataDir(cliDataDir) {
  const raw = cliDataDir || process.env.DATA_DIR || './data';
  return path.isAbsolute(raw) ? raw : path.resolve(serviceRoot, raw);
}

function matches(userId, extraMatches) {
  if (extraMatches.includes(userId)) return true;
  if (DEFAULT_EXACT.has(userId)) return true;
  return DEFAULT_PREFIXES.some((p) => userId.startsWith(p));
}

function dirStats(dirPath) {
  let bytes = 0;
  let files = 0;
  let lastMtimeMs = 0;
  const walk = (p) => {
    for (const entry of fs.readdirSync(p, { withFileTypes: true })) {
      const full = path.join(p, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        const st = fs.statSync(full);
        bytes += st.size;
        files += 1;
        if (st.mtimeMs > lastMtimeMs) lastMtimeMs = st.mtimeMs;
      }
    }
  };
  try {
    walk(dirPath);
  } catch {
    // Partial stats are fine for a listing.
  }
  return { bytes, files, lastMtimeMs };
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${bytes}B`;
}

const args = parseArgs(process.argv);
const dataDir = resolveDataDir(args.dataDir);
const usersDir = path.join(dataDir, 'users');

if (!fs.existsSync(usersDir)) {
  console.error(`No users directory at ${usersDir} (set --data-dir or DATA_DIR).`);
  process.exit(1);
}

const allUsers = fs
  .readdirSync(usersDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

const candidates = allUsers.filter((u) => matches(u, args.extraMatches));

console.log(`users dir: ${usersDir}`);
console.log(`total user directories: ${allUsers.length}, matched test candidates: ${candidates.length}\n`);

if (candidates.length === 0) {
  console.log('Nothing matched. Add ids with --match <userId> if needed.');
  process.exit(0);
}

for (const userId of candidates) {
  const full = path.join(usersDir, userId);
  const { bytes, files, lastMtimeMs } = dirStats(full);
  const last = lastMtimeMs ? new Date(lastMtimeMs).toISOString().slice(0, 10) : 'unknown';
  console.log(`  ${userId}  (${files} files, ${formatBytes(bytes)}, last modified ${last})`);
}

if (!args.apply) {
  console.log('\nDry-run only. Re-run with --apply to move these into deleted-users/.');
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const trashDir = path.join(dataDir, 'deleted-users', stamp);
fs.mkdirSync(trashDir, { recursive: true });

let moved = 0;
for (const userId of candidates) {
  const from = path.join(usersDir, userId);
  const to = path.join(trashDir, userId);
  try {
    fs.renameSync(from, to);
    moved += 1;
    console.log(`moved ${userId} -> ${path.relative(dataDir, to)}`);
  } catch (err) {
    console.error(`FAILED to move ${userId}: ${err instanceof Error ? err.message : err}`);
  }
}

console.log(`\nDone: moved ${moved}/${candidates.length} directories into ${trashDir}`);
console.log('Purge that folder manually once verified. Analytics history is unaffected.');
