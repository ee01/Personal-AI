import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const bridgeRoot = path.resolve(__dirname, '..');
const distDir = path.join(bridgeRoot, 'dist');
const tscEntrypoint = path.join(bridgeRoot, 'node_modules', 'typescript', 'bin', 'tsc');
const nativeHelperBuilds = [
  {
    source: path.join(bridgeRoot, 'app', 'native', 'shortcut-helper.swift'),
    output: path.join(bridgeRoot, 'app', 'native', 'bin', 'doubao-bridge-shortcut-helper'),
    frameworks: ['Carbon'],
  },
  {
    source: path.join(bridgeRoot, 'app', 'native', 'speech-helper.swift'),
    output: path.join(bridgeRoot, 'app', 'native', 'bin', 'doubao-bridge-speech-helper'),
    frameworks: ['Speech', 'AVFoundation'],
  },
  {
    source: path.join(bridgeRoot, 'app', 'native', 'key-state-helper.swift'),
    output: path.join(bridgeRoot, 'app', 'native', 'bin', 'doubao-bridge-key-state-helper'),
    frameworks: ['ApplicationServices'],
  },
];

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: bridgeRoot,
      stdio: 'inherit',
      env: process.env,
      ...options,
    });

    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Command failed: ${command} ${args.join(' ')} (code=${code ?? 'null'}, signal=${signal ?? 'null'})`));
    });
  });
}

async function normalizeReadablePermissions(targetDir) {
  await fs.chmod(targetDir, 0o755);
  const entries = await fs.readdir(targetDir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      await normalizeReadablePermissions(entryPath);
      continue;
    }
    if (entry.isFile()) {
      await fs.chmod(entryPath, 0o644);
    }
  }
}

async function main() {
  await fs.rm(distDir, { recursive: true, force: true });
  await run(process.execPath, [tscEntrypoint, '-p', 'tsconfig.json']);
  await normalizeReadablePermissions(distDir);
  if (process.platform === 'darwin') {
    for (const helper of nativeHelperBuilds) {
      await fs.mkdir(path.dirname(helper.output), { recursive: true });
      const args = ['swiftc', '-O'];
      for (const framework of helper.frameworks) {
        args.push('-framework', framework);
      }
      args.push(helper.source, '-o', helper.output);
      await run('/usr/bin/xcrun', args);
      await fs.chmod(helper.output, 0o755);
    }
  }
}

main().catch((error) => {
  console.error('Failed to build Doubao Bridge:', error);
  process.exit(1);
});
