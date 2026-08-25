/**
 * Personal AI backup encryption: PABK1 + scrypt + AES-256-GCM stream.
 *
 * Layout:
 *   magic(5) "PABK1" | salt(32) | iv(12) | ciphertext | tag(16) at EOF
 *
 * GCM tag is at EOF, so decrypt MUST consume the whole file before import.
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scrypt,
  type ScryptOptions,
} from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';

export const BACKUP_CRYPTO_MAGIC = Buffer.from('PABK1');
const SALT_LENGTH = 32;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const HEADER_LENGTH = BACKUP_CRYPTO_MAGIC.length + SALT_LENGTH + IV_LENGTH;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 } as const;

export class BackupCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupCryptoError';
  }
}

function deriveKey(passphrase: string, salt: Buffer): Promise<Buffer> {
  const options: ScryptOptions = {
    ...SCRYPT_PARAMS,
    maxmem: 64 * 1024 * 1024,
  };
  return new Promise((resolve, reject) => {
    scrypt(passphrase, salt, KEY_LENGTH, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey as Buffer);
    });
  });
}

export async function encryptBackupFile(
  inputPath: string,
  outputPath: string,
  passphrase: string,
): Promise<{ sizeBytes: number }> {
  if (!passphrase) {
    throw new BackupCryptoError('Encryption passphrase is required');
  }

  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = await deriveKey(passphrase, salt);
  const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_LENGTH });
  const output = createWriteStream(outputPath);

  await new Promise<void>((resolve, reject) => {
    const fail = (error: Error) => {
      output.destroy();
      reject(error);
    };
    output.on('error', fail);
    cipher.on('error', fail);
    output.write(Buffer.concat([BACKUP_CRYPTO_MAGIC, salt, iv]), (headerError) => {
      if (headerError) {
        fail(headerError);
        return;
      }
      const input = createReadStream(inputPath);
      input.on('error', fail);
      cipher.on('end', () => {
        try {
          output.end(cipher.getAuthTag(), () => resolve());
        } catch (error) {
          fail(error instanceof Error ? error : new Error(String(error)));
        }
      });
      input.pipe(cipher).pipe(output, { end: false });
    });
  });

  const stat = await fs.stat(outputPath);
  return { sizeBytes: stat.size };
}

export async function decryptBackupFile(
  inputPath: string,
  outputPath: string,
  passphrase: string,
): Promise<{ sizeBytes: number }> {
  if (!passphrase) {
    throw new BackupCryptoError('Decryption passphrase is required');
  }

  const stat = await fs.stat(inputPath);
  if (stat.size < HEADER_LENGTH + TAG_LENGTH) {
    throw new BackupCryptoError('Encrypted backup is truncated');
  }

  const handle = await fs.open(inputPath, 'r');
  try {
    const header = Buffer.alloc(HEADER_LENGTH);
    await handle.read(header, 0, HEADER_LENGTH, 0);
    if (!header.subarray(0, BACKUP_CRYPTO_MAGIC.length).equals(BACKUP_CRYPTO_MAGIC)) {
      throw new BackupCryptoError('Not a Personal AI encrypted backup (missing PABK1 magic)');
    }

    const salt = header.subarray(
      BACKUP_CRYPTO_MAGIC.length,
      BACKUP_CRYPTO_MAGIC.length + SALT_LENGTH,
    );
    const iv = header.subarray(
      BACKUP_CRYPTO_MAGIC.length + SALT_LENGTH,
      HEADER_LENGTH,
    );
    const tag = Buffer.alloc(TAG_LENGTH);
    await handle.read(tag, 0, TAG_LENGTH, stat.size - TAG_LENGTH);

    const key = await deriveKey(passphrase, salt);
    const decipher = createDecipheriv('aes-256-gcm', key, iv, {
      authTagLength: TAG_LENGTH,
    });
    decipher.setAuthTag(tag);

    const ciphertextEnd = stat.size - TAG_LENGTH - 1;
    const input = createReadStream(inputPath, {
      start: HEADER_LENGTH,
      end: ciphertextEnd,
    });

    try {
      await pipeline(input, decipher, createWriteStream(outputPath));
    } catch (error) {
      await fs.rm(outputPath, { force: true });
      throw new BackupCryptoError(
        error instanceof Error && /auth|unable to authenticate/i.test(error.message)
          ? 'Wrong passphrase or backup was tampered with'
          : error instanceof Error
            ? error.message
            : String(error),
      );
    }
  } finally {
    await handle.close();
  }

  const outStat = await fs.stat(outputPath);
  return { sizeBytes: outStat.size };
}

export async function isEncryptedBackupFile(filePath: string): Promise<boolean> {
  try {
    const handle = await fs.open(filePath, 'r');
    try {
      const magic = Buffer.alloc(BACKUP_CRYPTO_MAGIC.length);
      await handle.read(magic, 0, magic.length, 0);
      return magic.equals(BACKUP_CRYPTO_MAGIC);
    } finally {
      await handle.close();
    }
  } catch {
    return false;
  }
}
