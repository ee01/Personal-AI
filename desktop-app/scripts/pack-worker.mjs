import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const desktopAppRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(desktopAppRoot, '..');
const workerRoot = path.join(repoRoot, 'worker');
const releaseDir = path.resolve(
  process.env.DESKTOP_APP_RELEASE_DIR ||
    process.env.DOUBAO_BRIDGE_RELEASE_DIR ||
    path.join(desktopAppRoot, 'release'),
);

async function run(command, args, options = {}) {
  return execFileAsync(command, args, {
    cwd: desktopAppRoot,
    maxBuffer: 10 * 1024 * 1024,
    env: {
      ...process.env,
      PATH: `${path.dirname(process.execPath)}:${process.env.PATH || ''}`,
    },
    ...options,
  });
}

export async function packWorkerRelease() {
  const packageJson = JSON.parse(
    await fs.readFile(path.join(workerRoot, 'package.json'), 'utf8'),
  );
  const version = String(packageJson.version || '0.0.0');
  const outDir = path.join(releaseDir, 'worker');
  await fs.mkdir(outDir, { recursive: true });

  console.log(`Building worker ${version}...`);
  await run('npm', ['run', 'build'], { cwd: workerRoot });

  const tgzPath = path.join(outDir, `worker-${version}.tgz`);
  await run(
    'tar',
    [
      '-czf',
      tgzPath,
      '--exclude',
      'node_modules',
      '--exclude',
      '.DS_Store',
      '-C',
      repoRoot,
      'worker',
    ],
    { cwd: repoRoot },
  );

  const installPath = path.join(outDir, 'install.sh');
  await fs.copyFile(path.join(workerRoot, 'install.sh'), installPath);
  await fs.chmod(installPath, 0o755);

  return {
    version,
    tagName: `worker-v${version}`,
    tgzPath,
    installPath,
    assetPaths: [tgzPath, installPath],
  };
}

export function getWorkerReleaseDir() {
  return path.join(releaseDir, 'worker');
}
