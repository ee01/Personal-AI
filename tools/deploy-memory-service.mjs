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

function runRemoteScript(host, script, label) {
  console.log(`\n[deploy] ${label}`);
  run('ssh', [
    '-o',
    'StrictHostKeyChecking=accept-new',
    host,
    `bash -lc ${shellQuote(script)}`,
  ]);
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

  run('rsync', [
    '-az',
    '-e',
    rsyncSsh,
    path.join(repoRoot, 'tools/deploy-memory-service.mjs'),
    `${options.host}:${options.remoteDir}/tools/deploy-memory-service.mjs`,
  ]);
} else {
  console.log('\nSkipping source sync; rebuilding the existing remote worktree.');
}

const remoteDir = shellQuote(options.remoteDir);
const userId = shellQuote(`X-User-Id: ${options.userId}`);
const watchdog = shellQuote(`${options.remoteDir}/tools/server-public-stack-watchdog.sh`);
const buildFlag = options.noCache ? ' --no-cache' : '';

const remotePreamble = `
set -euo pipefail
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
cd ${remoteDir}
test -f docker-compose.yml
test -f memory-service/Dockerfile
docker info >/dev/null
echo "[deploy] docker daemon ok"
`;

const volumeRestore = `
VOLUME_NAME="$(basename "$PWD" | tr -cd '[:alnum:]_-')_memory-data"
if docker volume inspect "$VOLUME_NAME" >/dev/null 2>&1; then
  touch .env
  if ! grep -q "^MEMORY_DATA_MOUNT=memory-data$" .env; then
    grep -v "^MEMORY_DATA_MOUNT=" .env > .env.tmp && mv .env.tmp .env
    echo MEMORY_DATA_MOUNT=memory-data >> .env
    echo "[deploy] restored MEMORY_DATA_MOUNT=memory-data ($VOLUME_NAME exists)"
  fi
else
  echo "[deploy] $VOLUME_NAME not found; compose default is the bind mount"
fi
`;

const tagRollbackImage = `
if docker image inspect personal-ai-memory-service >/dev/null 2>&1; then
  docker tag personal-ai-memory-service personal-ai-memory-service:rollback
  echo "[deploy] tagged personal-ai-memory-service:rollback"
else
  echo "[deploy] no existing image to tag for rollback"
fi
`;

const rollbackToPreviousImage = `
rollback_deployed_image() {
  if docker image inspect personal-ai-memory-service:rollback >/dev/null 2>&1; then
    echo "[deploy] rolling back to personal-ai-memory-service:rollback"
    docker tag personal-ai-memory-service:rollback personal-ai-memory-service
    docker compose up -d --force-recreate --no-build memory-service
    return 0
  fi
  echo "[deploy] no rollback image available"
  return 1
}
`;

const buildScript = `
${remotePreamble}
${volumeRestore}
${tagRollbackImage}
echo "[deploy] phase 1/2: build image (running container is untouched)"
docker compose build${buildFlag} memory-service
echo "[deploy] build complete"
`;

const rolloutScript = `
${remotePreamble}
${rollbackToPreviousImage}
echo "[deploy] phase 2/2: recreate container from the new image"
if ! docker compose up -d --force-recreate --remove-orphans memory-service; then
  echo "[deploy] compose up failed"
  rollback_deployed_image || true
  exit 1
fi
for attempt in $(seq 1 40); do
  if curl -fsS http://127.0.0.1:3210/health >/dev/null 2>&1; then
    echo "[deploy] health ok (attempt $attempt)"
    break
  fi
  if [ "$attempt" -eq 40 ]; then
    echo "[deploy] health check timed out after recreate"
    rollback_deployed_image || true
    exit 1
  fi
  sleep 3
done
curl -fsS http://127.0.0.1:3210/health >/dev/null
API_KEY="$(python3 -c 'from pathlib import Path; vals={};
[vals.__setitem__(k.strip(), v.strip()) for line in Path("memory-service/.env").read_text().splitlines() if line and not line.startswith("#") and "=" in line for k,v in [line.split("=",1)]];
print(vals.get("API_KEY",""))')"
if [ -n "$API_KEY" ]; then AUTH_HEADER="Authorization: Bearer $API_KEY"; else AUTH_HEADER=""; fi
if [ -n "$AUTH_HEADER" ]; then
  curl -fsS -H "$AUTH_HEADER" -H ${userId} -H 'Content-Type: application/json' --data-binary '{"dryRun":true,"limit":1}' http://127.0.0.1:3210/api/v1/confirm-requests/reclassify-legacy >/dev/null
else
  curl -fsS -H ${userId} -H 'Content-Type: application/json' --data-binary '{"dryRun":true,"limit":1}' http://127.0.0.1:3210/api/v1/confirm-requests/reclassify-legacy >/dev/null
fi
docker compose ps memory-service
docker inspect memory-service --format "{{range .Mounts}}{{if eq .Destination \\"/app/data\\"}}[deploy] /app/data <- {{.Type}} {{or .Name .Source}}{{end}}{{end}}"
${watchdog}
`;

runRemoteScript(options.host, buildScript, 'remote build');
runRemoteScript(options.host, rolloutScript, 'remote rollout');

console.log('\nMemory service deploy completed.');
