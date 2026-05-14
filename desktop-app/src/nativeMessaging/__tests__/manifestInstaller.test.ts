import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HOST_NAME,
  getNmBridgePath,
  getNmManifestDir,
  getNmManifestPath,
  getNmTokenPath,
  writeNmToken,
} from '../manifestInstaller.js';
import { homedir } from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

async function createTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

test('HOST_NAME is correct', () => {
  assert.equal(HOST_NAME, 'com.personal_ai.whisper_host');
});

test('getNmManifestDir returns correct Chrome NativeMessagingHosts path', () => {
  const dir = getNmManifestDir();
  assert.ok(dir.includes('Google'), 'should include Google');
  assert.ok(dir.includes('Chrome'), 'should include Chrome');
  assert.ok(
    dir.includes('NativeMessagingHosts'),
    'should include NativeMessagingHosts',
  );
  assert.ok(dir.startsWith(homedir()), 'should be under home directory');
});

test('getNmManifestPath ends with host name json', () => {
  const path = getNmManifestPath();
  assert.ok(
    path.endsWith(`${HOST_NAME}.json`),
    `should end with ${HOST_NAME}.json`,
  );
});

test('getNmManifestPath is inside getNmManifestDir', () => {
  const dir = getNmManifestDir();
  const path = getNmManifestPath();
  assert.ok(
    path.startsWith(dir),
    `manifest path should be inside manifest dir`,
  );
});

test('getNmBridgePath points to native host executable path', () => {
  const bridgePath = getNmBridgePath();
  assert.ok(
    bridgePath.endsWith(path.join('app', 'native', 'bin', 'nm-whisper-bridge')),
    `bridge path should end with app/native/bin/nm-whisper-bridge, got ${bridgePath}`,
  );
});

test('getNmTokenPath points to Personal AI token file', () => {
  const tokenPath = getNmTokenPath();
  assert.ok(
    tokenPath.startsWith(homedir()),
    'token path should be under home directory',
  );
  assert.ok(
    tokenPath.endsWith('.nm-token'),
    'token path should end with .nm-token',
  );
  assert.ok(
    tokenPath.includes('Personal AI'),
    'token path should include Personal AI directory',
  );
});

test('writeNmToken writes a token file to the expected location', async () => {
  const tempDir = await createTempDir('personal-ai-nm-token-');
  const previousTokenPath = process.env.DESKTOP_APP_NM_TOKEN_PATH;
  const tokenPath = path.join(tempDir, '.nm-token');
  process.env.DESKTOP_APP_NM_TOKEN_PATH = tokenPath;

  try {
    assert.equal(getNmTokenPath(), tokenPath);
    await writeNmToken('test-token');
    const content = await fs.readFile(tokenPath, 'utf8');
    assert.equal(content, 'test-token');
  } finally {
    if (previousTokenPath === undefined) {
      delete process.env.DESKTOP_APP_NM_TOKEN_PATH;
    } else {
      process.env.DESKTOP_APP_NM_TOKEN_PATH = previousTokenPath;
    }
  }
});
