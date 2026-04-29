import { accessSync, constants, createWriteStream } from 'node:fs';
import { chmod, mkdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { homedir, arch, platform } from 'node:os';
import { join } from 'node:path';

const execFileAsync = promisify(execFile);

const WHEEL_VERSION = '0.0.3';
const WHEEL_ASSETS: Record<
  string,
  { url: string; sha256: string; entry: string }
> = {
  'darwin-arm64': {
    url: 'https://files.pythonhosted.org/packages/fd/eb/4d1a96d887b62fdddc58e3e0c9c94f673b54cd9fc025329340f9c4d052bc/whisper_cpp_cli-0.0.3-py3-none-macosx_11_0_arm64.whl',
    sha256: '6c9cb1d10770da5b7f92c54c2ace29142694b5b392c274db1d95ce1d2f6223d2',
    entry: 'whisper_cpp_cli-0.0.3.data/scripts/whisper-cpp',
  },
  'darwin-x64': {
    url: 'https://files.pythonhosted.org/packages/a5/11/359833bd72353eb0142defc26ac2d8bd957da5b72540bd546ce7f0caea83/whisper_cpp_cli-0.0.3-py3-none-macosx_10_12_x86_64.whl',
    sha256: '1d85c6ca3dbf907c07a59f8daa620b3d0e3b263356c5220357dd7e06b42bc523',
    entry: 'whisper_cpp_cli-0.0.3.data/scripts/whisper-cpp',
  },
};

let installInProgress = false;
let installProgress = 0;
let lastInstallError: string | undefined;

export function getWhisperBinaryDir(): string {
  return join(
    homedir(),
    'Library',
    'Application Support',
    'Personal AI',
    'whisper-bin',
    `whisper-cpp-cli-${WHEEL_VERSION}`,
  );
}

export function getManagedWhisperBinaryPath(): string {
  return join(getWhisperBinaryDir(), 'whisper-cpp');
}

export function getManagedWhisperServerBinaryPath(): string {
  return join(getWhisperBinaryDir(), 'whisper-server');
}

export function isManagedWhisperBinaryReady(): boolean {
  const binaryPath = getManagedWhisperBinaryPath();
  try {
    accessSync(binaryPath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export function getWhisperBinaryInstallStatus(): {
  ready: boolean;
  installInProgress: boolean;
  installProgress: number;
  error?: string;
  path: string;
} {
  return {
    ready: isManagedWhisperBinaryReady(),
    installInProgress,
    installProgress,
    error: lastInstallError,
    path: getManagedWhisperBinaryPath(),
  };
}

export async function ensureWhisperBinary(): Promise<{
  ok: boolean;
  path?: string;
  downloading?: boolean;
  error?: string;
}> {
  const binaryPath = getManagedWhisperBinaryPath();
  if (isManagedWhisperBinaryReady()) {
    return { ok: true, path: binaryPath };
  }
  if (installInProgress) {
    return { ok: true, downloading: true, path: binaryPath };
  }

  installInProgress = true;
  installProgress = 0;
  lastInstallError = undefined;

  void installWhisperBinary()
    .catch((error) => {
      lastInstallError = String((error as Error)?.message || error);
    })
    .finally(() => {
      installInProgress = false;
    });

  return { ok: true, downloading: true, path: binaryPath };
}

async function installWhisperBinary(): Promise<void> {
  const asset = selectWheelAsset();
  if (!asset) {
    throw new Error(`No managed whisper binary for ${platform()}-${arch()}`);
  }

  const binaryDir = getWhisperBinaryDir();
  const binaryPath = getManagedWhisperBinaryPath();
  const wheelPath = `${binaryPath}.whl.tmp`;
  const extractedPath = `${binaryPath}.tmp`;

  await mkdir(binaryDir, { recursive: true });
  await downloadFile(asset.url, wheelPath, asset.sha256, (pct) => {
    installProgress = Math.min(pct, 95);
  });

  await unlink(extractedPath).catch(() => undefined);
  await execFileAsync('/usr/bin/unzip', ['-p', wheelPath, asset.entry], {
    encoding: 'buffer',
    maxBuffer: 8 * 1024 * 1024,
  }).then(async ({ stdout }) => {
    await writeFile(extractedPath, stdout);
  });

  const info = await stat(extractedPath);
  if (info.size < 100_000) {
    throw new Error('Downloaded whisper binary is unexpectedly small');
  }
  await chmod(extractedPath, 0o755);
  await rename(extractedPath, binaryPath);
  await unlink(wheelPath).catch(() => undefined);
  installProgress = 100;
}

function selectWheelAsset():
  | { url: string; sha256: string; entry: string }
  | undefined {
  return WHEEL_ASSETS[`${platform()}-${arch()}`];
}

async function downloadFile(
  url: string,
  targetPath: string,
  expectedSha256: string,
  onProgress: (pct: number) => void,
): Promise<void> {
  await unlink(targetPath).catch(() => undefined);
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download whisper binary: HTTP ${response.status}`);
  }

  const contentLength = Number(response.headers.get('content-length') || 0);
  const hash = createHash('sha256');
  const fileStream = createWriteStream(targetPath);
  const reader = response.body.getReader();
  let downloaded = 0;

  await new Promise<void>((resolve, reject) => {
    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          hash.update(value);
          fileStream.write(value);
          downloaded += value.length;
          if (contentLength > 0) {
            onProgress(Math.floor((downloaded / contentLength) * 100));
          }
        }
        fileStream.end();
        fileStream.once('finish', resolve);
        fileStream.once('error', reject);
      } catch (error) {
        reject(error);
      }
    };
    void pump();
  });

  const actualSha256 = hash.digest('hex');
  if (actualSha256 !== expectedSha256) {
    await unlink(targetPath).catch(() => undefined);
    throw new Error('Downloaded whisper binary checksum mismatch');
  }
}
