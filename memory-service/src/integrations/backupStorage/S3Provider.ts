import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { AwsClient } from 'aws4fetch';

import type {
  BackupObjectInfo,
  BackupPutInput,
  BackupStorageProvider,
} from './types.js';

export interface S3ProviderOptions {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

function objectUrl(options: S3ProviderOptions, key: string): string {
  const endpoint = options.endpoint.replace(/\/+$/, '');
  const encodedKey = key
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
  if (endpoint.includes(options.bucket)) {
    return `${endpoint}/${encodedKey}`;
  }
  return `${endpoint}/${encodeURIComponent(options.bucket)}/${encodedKey}`;
}

export class S3Provider implements BackupStorageProvider {
  readonly kind = 's3' as const;
  private readonly client: AwsClient;

  constructor(private readonly options: S3ProviderOptions) {
    if (!options.endpoint.trim() || !options.bucket.trim()) {
      throw new Error('S3 endpoint and bucket are required');
    }
    this.client = new AwsClient({
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
      region: options.region || 'auto',
      service: 's3',
    });
  }

  async put(input: BackupPutInput): Promise<void> {
    const url = objectUrl(this.options, input.key);
    const response = await this.client.fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': input.contentType || 'application/octet-stream',
        'Content-Length': String(input.sizeBytes),
        'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
      },
      duplex: 'half',
      body: createReadStream(input.filePath) as unknown as BodyInit,
    } as RequestInit);
    if (!response.ok) {
      throw new Error(`S3 PUT failed (${response.status}): ${await safeText(response)}`);
    }
  }

  async head(key: string): Promise<BackupObjectInfo> {
    const response = await this.client.fetch(objectUrl(this.options, key), {
      method: 'HEAD',
    });
    if (!response.ok) {
      throw new Error(`S3 HEAD failed (${response.status})`);
    }
    const length = Number(response.headers.get('content-length') || '0');
    return {
      key,
      sizeBytes: Number.isFinite(length) ? length : 0,
      lastModified: response.headers.get('last-modified') || undefined,
    };
  }

  async list(prefix: string): Promise<BackupObjectInfo[]> {
    const endpoint = this.options.endpoint.replace(/\/+$/, '');
    const bucketPath = endpoint.includes(this.options.bucket)
      ? endpoint
      : `${endpoint}/${encodeURIComponent(this.options.bucket)}`;
    const url = `${bucketPath}?list-type=2&prefix=${encodeURIComponent(prefix)}`;
    const response = await this.client.fetch(url, { method: 'GET' });
    if (!response.ok) {
      throw new Error(`S3 ListObjects failed (${response.status})`);
    }
    const xml = await response.text();
    return parseListObjects(xml);
  }

  async delete(key: string): Promise<void> {
    const response = await this.client.fetch(objectUrl(this.options, key), {
      method: 'DELETE',
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`S3 DELETE failed (${response.status})`);
    }
  }

  async test(): Promise<{ ok: true; detail: string }> {
    const probeKey = `_pai-probe-${Date.now()}.txt`;
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pai-s3-'));
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
        throw new Error(
          `probe size mismatch: wrote ${Buffer.byteLength(payload)}, head ${head.sizeBytes}`,
        );
      }
      await this.delete(probeKey);
      return { ok: true, detail: '连接正常，可写可删' };
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  }
}

function parseListObjects(xml: string): BackupObjectInfo[] {
  const items: BackupObjectInfo[] = [];
  const contents = xml.split(/<Contents>/i).slice(1);
  for (const block of contents) {
    const keyMatch = block.match(/<Key>([^<]+)</i);
    const sizeMatch = block.match(/<Size>(\d+)</i);
    const modifiedMatch = block.match(/<LastModified>([^<]+)</i);
    if (!keyMatch) continue;
    const key = keyMatch[1];
    if (key.split('/').pop()?.startsWith('_pai-probe-')) continue;
    items.push({
      key,
      sizeBytes: sizeMatch ? Number(sizeMatch[1]) : 0,
      lastModified: modifiedMatch?.[1],
    });
  }
  return items;
}

async function safeText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 300);
  } catch {
    return response.statusText;
  }
}
