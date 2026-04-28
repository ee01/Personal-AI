import { writeFile, mkdir, chmod } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const HOST_NAME = 'com.personal_ai.whisper_host';

export function getNmManifestDir(): string {
  return join(
    homedir(),
    'Library',
    'Application Support',
    'Google',
    'Chrome',
    'NativeMessagingHosts',
  );
}

export function getNmManifestPath(): string {
  return join(getNmManifestDir(), `${HOST_NAME}.json`);
}

export function getNmBridgePath(): string {
  return resolve(
    join(__dirname, '..', '..', 'app', 'native', 'bin', 'nm-whisper-bridge'),
  );
}

export function getNmTokenPath(): string {
  return join(
    homedir(),
    'Library',
    'Application Support',
    'Personal AI',
    '.nm-token',
  );
}

export async function writeNmToken(token: string): Promise<void> {
  const tokenPath = getNmTokenPath();
  await mkdir(resolve(tokenPath, '..'), { recursive: true });
  await writeFile(tokenPath, token.trim(), 'utf8');
  await chmod(tokenPath, 0o600);
}

export async function installManifest(extensionIds: string[]): Promise<void> {
  const manifestDir = getNmManifestDir();
  const manifestPath = getNmManifestPath();
  const bridgePath = getNmBridgePath();

  await mkdir(manifestDir, { recursive: true });

  const allowedOrigins = extensionIds.map((id) => `chrome-extension://${id}/`);

  const manifest = {
    name: HOST_NAME,
    description: 'Personal AI Whisper ASR bridge',
    path: bridgePath,
    type: 'stdio',
    allowed_origins: allowedOrigins,
  };

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  if (existsSync(bridgePath)) {
    await chmod(bridgePath, 0o755);
  }
}

export async function isManifestInstalled(): Promise<boolean> {
  return existsSync(getNmManifestPath());
}
