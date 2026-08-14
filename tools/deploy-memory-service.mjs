import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\"'\"'`)}'`;
}

function run(command, args, options = {}) {
  const printable = [command, ...args].join(' ');
  console.log(`\n$ ${printable}`);
  execFileSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    ...options,
  });
}

function parseArgs(argv) {
  const options = {
    host: process.env.MEMORY_DEPLOY_HOST || 'rcadmin@10.32.56.212',
    remoteDir: process.env.MEMORY_DEPLOY_PATH || '/Users/rcadmin/personal-ai',
    userId: process.env.MEMORY_DEPLOY_USER_ID || 'esone.qiu',
    skipLocalBuild: false,
    skipSync: false,
    noCache: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--host' && argv[index + 1]) {
      options.host = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--remote-dir' && argv[index + 1]) {
      options.remoteDir = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--user-id' && argv[index + 1]) {
      options.userId = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--skip-local-build') {
      options.skipLocalBuild = true;
      continue;
    }
    if (arg === '--skip-sync') {
      options.skipSync = true;
      continue;
    }
    if (arg === '--no-cache') {
      options.noCache = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

const options = parseArgs(process.argv.slice(2));
const sshArgs = ['-o', 'StrictHostKeyChecking=accept-new'];
const rsyncSsh = `ssh ${sshArgs.join(' ')}`;

if (!options.skipSync && !options.skipLocalBuild) {
  run('npm', ['--prefix', 'memory-service', 'run', 'build']);
}

if (!options.skipSync) {
  run('rsync', [
    '-az',
    '--delete',
    '--exclude',
    '.env',
    '--exclude',
    'data/',
    '--exclude',
    'node_modules/',
    '--exclude',
    'dist/',
    '--exclude',
    'coverage/',
    '--exclude',
    '.DS_Store',
    '-e',
    rsyncSsh,
    `${path.join(repoRoot, 'memory-service')}/`,
    `${options.host}:${options.remoteDir}/memory-service/`,
  ]);

  run('rsync', [
    '-az',
    '-e',
    rsyncSsh,
    path.join(repoRoot, 'docker-compose.yml'),
    `${options.host}:${options.remoteDir}/docker-compose.yml`,
  ]);
} else {
  console.log('\nSkipping source sync; rebuilding the existing remote worktree.');
}

const remoteSteps = [
  'set -euo pipefail',
  'export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"',
  `cd ${shellQuote(options.remoteDir)}`,
  'test -f docker-compose.yml',
  'test -f memory-service/Dockerfile',
  `docker compose build${options.noCache ? ' --no-cache' : ''} memory-service`,
  'docker compose stop memory-service 2>/dev/null || true',
  'docker compose rm -f -s memory-service 2>/dev/null || true',
  'docker rm -f memory-service 2>/dev/null || true',
  'docker compose up -d --force-recreate --remove-orphans memory-service',
  'for attempt in $(seq 1 30); do curl -fsS http://127.0.0.1:3210/health >/dev/null && break; sleep 2; done',
  'curl -fsS http://127.0.0.1:3210/health >/dev/null',
  `API_KEY="$(python3 -c 'from pathlib import Path; vals={};
[vals.__setitem__(k.strip(), v.strip()) for line in Path("memory-service/.env").read_text().splitlines() if line and not line.startswith("#") and "=" in line for k,v in [line.split("=",1)]];
print(vals.get("API_KEY",""))')"`,
  'if [ -n "$API_KEY" ]; then AUTH_HEADER="Authorization: Bearer $API_KEY"; else AUTH_HEADER=""; fi',
  `if [ -n "$AUTH_HEADER" ]; then curl -fsS -H "$AUTH_HEADER" -H ${shellQuote(`X-User-Id: ${options.userId}`)} -H 'Content-Type: application/json' --data-binary ${shellQuote('{"dryRun":true,"limit":1}')} http://127.0.0.1:3210/api/v1/confirm-requests/reclassify-legacy >/dev/null; else curl -fsS -H ${shellQuote(`X-User-Id: ${options.userId}`)} -H 'Content-Type: application/json' --data-binary ${shellQuote('{"dryRun":true,"limit":1}')} http://127.0.0.1:3210/api/v1/confirm-requests/reclassify-legacy >/dev/null; fi`,
  'docker compose ps memory-service',
  shellQuote(`${options.remoteDir}/tools/server-public-stack-watchdog.sh`),
];

run('ssh', [
  ...sshArgs,
  options.host,
  `bash -lc ${shellQuote(remoteSteps.join(' && '))}`,
]);

console.log('\nMemory service deploy completed.');
