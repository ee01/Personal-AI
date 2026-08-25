#!/usr/bin/env npx tsx
/**
 * Encrypt / decrypt Personal AI memory backups (PABK1 + AES-256-GCM).
 *
 *   npx tsx tools/backup-crypt.ts encrypt <input.zip> <output.zip.enc>
 *   npx tsx tools/backup-crypt.ts decrypt <input.zip.enc> <output.zip>
 *
 * Passphrase: env BACKUP_PASSPHRASE, or prompt on stdin.
 *
 * Recovery: decrypt first (this CLI verifies GCM tag at EOF), then
 * POST /api/v1/import with dryRun=true, then confirm.
 */

import { createInterface } from 'node:readline/promises';
import { stdin as stdinFd, stdout as stdoutFd } from 'node:process';

import {
  decryptBackupFile,
  encryptBackupFile,
} from '../src/core/backup/backupCrypto.js';

async function readPassphrase(): Promise<string> {
  if (process.env.BACKUP_PASSPHRASE) {
    return process.env.BACKUP_PASSPHRASE;
  }
  if (!stdinFd.isTTY) {
    throw new Error('BACKUP_PASSPHRASE is required when stdin is not a TTY');
  }
  const rl = createInterface({ input: stdinFd, output: stdoutFd });
  try {
    return (await rl.question('Backup passphrase: ')).trim();
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  const [command, input, output] = process.argv.slice(2);
  if (
    (command !== 'encrypt' && command !== 'decrypt') ||
    !input ||
    !output
  ) {
    console.error(
      'Usage: npx tsx tools/backup-crypt.ts <encrypt|decrypt> <input> <output>',
    );
    process.exit(2);
  }

  const passphrase = await readPassphrase();
  if (!passphrase) {
    console.error('Passphrase is empty; aborting.');
    process.exit(2);
  }

  if (command === 'encrypt') {
    const result = await encryptBackupFile(input, output, passphrase);
    console.log(`Encrypted ${input} → ${output} (${result.sizeBytes} bytes)`);
    return;
  }

  const result = await decryptBackupFile(input, output, passphrase);
  console.log(`Decrypted ${input} → ${output} (${result.sizeBytes} bytes)`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
