import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

import type {
  BackupObjectInfo,
  BackupPutInput,
  BackupStorageProvider,
} from './types.js';

export class LocalDirProvider implements BackupStorageProvider {
  readonly kind = 'local' as const;

  constructor(private readonly rootDir: string) {
    if (!rootDir.trim()) {
      throw new Error('Local backup directory is required');
    }
  }

  private resolve(key: string): string {
    const target = path.resolve(this.rootDir, key);
    const root = path.resolve(this.rootDir);
    if (target !== root && !target.startsWith(root + path.sep)) {
      throw new Error(`Unsafe backup object key: ${key}`);
    }
    return target;
  }

  async put(input: BackupPutInput): Promise<void> {
    const target = this.resolve(input.key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await pipeline(createReadStream(input.filePath), createWriteStream(target));
  }

  async head(key: string): Promise<BackupObjectInfo> {
    const target = this.resolve(key);
    const stat = await fs.stat(target);
    return {
      key,
      sizeBytes: stat.size,
      lastModified: stat.mtime.toISOString(),
    };
  }

  async list(prefix: string): Promise<BackupObjectInfo[]> {
    const dir = this.resolve(prefix.replace(/\/+$/, '') || '.');
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const items: BackupObjectInfo[] = [];
      for (const entry of entries) {
        if (!entry.isFile() || entry.name.startsWith('_pai-probe-')) continue;
        const full = path.join(dir, entry.name);
        const stat = await fs.stat(full);
        items.push({
          key: path.posix.join(prefix.replace(/\/+$/, ''), entry.name),
          sizeBytes: stat.size,
          lastModified: stat.mtime.toISOString(),
        });
      }
      return items;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') return [];
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.resolve(key), { force: true });
  }

  async test(): Promise<{ ok: true; detail: string }> {
    const probeKey = `_pai-probe-${Date.now()}.txt`;
    const tmpDir = await fs.mkdtemp(path.join(this.rootDir, '.probe-'));
    const tmp = path.join(tmpDir, 'probe.txt');
    const payload = `personal-ai-backup-probe ${new Date().toISOString()}\n`;
    await fs.writeFile(tmp, payload, 'utf-8');
    try {
      await this.put({
        key: probeKey,
        filePath: tmp,
        sizeBytes: Buffer.byteLength(payload),
        contentType: 'text/plain',
      });
      const head = await this.head(probeKey);
      if (head.sizeBytes !== Buffer.byteLength(payload)) {
        throw new Error('probe size mismatch');
      }
      await this.delete(probeKey);
      return { ok: true, detail: '连接正常，可写可删' };
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  }
}
