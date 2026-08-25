import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  decryptBackupFile,
  encryptBackupFile,
  isEncryptedBackupFile,
} from '../core/backup/backupCrypto.js';

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('backupCrypto', () => {
  it('round-trips a file and rejects a wrong passphrase or truncated tag', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'pai-crypto-'));
    dirs.push(dir);
    const input = path.join(dir, 'plain.zip');
    const encrypted = path.join(dir, 'plain.zip.enc');
    const decrypted = path.join(dir, 'round.zip');
    const payload = Buffer.alloc(256 * 1024, 7);
    payload.write('personal-ai-memory-backup');
    await writeFile(input, payload);

    await encryptBackupFile(input, encrypted, 'correct-horse');
    expect(await isEncryptedBackupFile(encrypted)).toBe(true);

    await decryptBackupFile(encrypted, decrypted, 'correct-horse');
    expect(await readFile(decrypted)).toEqual(payload);

    await expect(
      decryptBackupFile(encrypted, path.join(dir, 'bad.zip'), 'wrong-pass'),
    ).rejects.toThrow(/Wrong passphrase|tampered/i);

    const damaged = path.join(dir, 'damaged.zip.enc');
    const bytes = await readFile(encrypted);
    bytes[bytes.length - 1] ^= 0xff;
    await writeFile(damaged, bytes);
    await expect(
      decryptBackupFile(damaged, path.join(dir, 'tampered.zip'), 'correct-horse'),
    ).rejects.toThrow(/Wrong passphrase|tampered/i);
  });
});
