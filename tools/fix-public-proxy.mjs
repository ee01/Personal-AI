import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function run(command, args) {
  const printable = [command, ...args].join(' ');
  console.log(`\n$ ${printable}`);
  execFileSync(command, args, { cwd: repoRoot, stdio: 'inherit' });
}

const host = process.env.ROADMAP_DEPLOY_HOST || process.env.MEMORY_DEPLOY_HOST || 'rcadmin@10.32.56.212';
const remoteDir = process.env.ROADMAP_DEPLOY_PATH || process.env.MEMORY_DEPLOY_PATH || '/Users/rcadmin/personal-ai';

run('rsync', [
  '-az',
  '-e',
  'ssh -o StrictHostKeyChecking=accept-new',
  path.join(repoRoot, 'tools/server-public-stack-watchdog.sh'),
  `${host}:${remoteDir}/tools/server-public-stack-watchdog.sh`,
]);

run('ssh', [
  '-o',
  'StrictHostKeyChecking=accept-new',
  host,
  `bash -lc 'chmod +x ${remoteDir}/tools/server-public-stack-watchdog.sh && ${remoteDir}/tools/server-public-stack-watchdog.sh'`,
]);

console.log('\nPublic proxy fix completed.');
