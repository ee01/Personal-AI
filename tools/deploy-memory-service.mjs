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
  run('npm', ['--prefix', 'roadmap-service', 'run', 'build']);
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

  // roadmap uses prebuilt dist/ + web/dist/ in Docker (avoids in-image tsc/vite)
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
    'coverage/',
    '--exclude',
    '.DS_Store',
    '-e',
    rsyncSsh,
    `${path.join(repoRoot, 'roadmap-service')}/`,
    `${options.host}:${options.remoteDir}/roadmap-service/`,
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
  `docker compose build${options.noCache ? ' --no-cache' : ''} memory-service roadmap-service`,
  'docker compose up -d memory-service roadmap-service',
  'for attempt in $(seq 1 30); do curl -fsS http://127.0.0.1:3210/health >/dev/null && break; sleep 2; done',
  'curl -fsS http://127.0.0.1:3210/health >/dev/null',
  'for attempt in $(seq 1 30); do curl -fsS http://127.0.0.1:3220/health >/dev/null && break; sleep 2; done',
  'curl -fsS http://127.0.0.1:3220/health >/dev/null',
  `curl -fsS -H ${shellQuote(`X-User-Id: ${options.userId}`)} -H 'Content-Type: application/json' --data-binary ${shellQuote('{"dryRun":true,"limit":1}')} http://127.0.0.1:3210/api/v1/confirm-requests/reclassify-legacy >/dev/null`,
  'docker compose ps memory-service roadmap-service',
];

run('ssh', [
  ...sshArgs,
  options.host,
  `bash -lc ${shellQuote(remoteSteps.join(' && '))}`,
]);

console.log('\nMemory + Roadmap service deploy completed.');
