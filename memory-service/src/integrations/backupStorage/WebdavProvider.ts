import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type {
  BackupObjectInfo,
  BackupPutInput,
  BackupStorageProvider,
} from './types.js';

export interface WebdavProviderOptions {
  baseUrl: string;
  username: string;
  password: string;
}

function joinUrl(baseUrl: string, key: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  const suffix = key.replace(/^\/+/, '');
  return `${base}/${suffix}`;
}

function authHeader(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

async function davFetch(
  url: string,
  options: WebdavProviderOptions,
  init: RequestInit,
): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: authHeader(options.username, options.password),
      ...(init.headers || {}),
    },
  });
  return response;
}

export class WebdavProvider implements BackupStorageProvider {
  readonly kind = 'webdav' as const;

  constructor(private readonly options: WebdavProviderOptions) {
    if (!options.baseUrl.trim()) {
      throw new Error('WebDAV URL is required');
    }
  }

  async put(input: BackupPutInput): Promise<void> {
    await this.ensureParentCollections(input.key);
    const url = joinUrl(this.options.baseUrl, input.key);
    const response = await davFetch(url, this.options, {
      method: 'PUT',
      headers: {
        'Content-Type': input.contentType || 'application/octet-stream',
        'Content-Length': String(input.sizeBytes),
      },
      // Node fetch requires duplex when sending a stream body.
      duplex: 'half',
      body: createReadStream(input.filePath) as unknown as BodyInit,
    } as RequestInit);
    if (!response.ok) {
      throw new Error(`WebDAV PUT failed (${response.status}): ${await safeText(response)}`);
    }
  }

  async head(key: string): Promise<BackupObjectInfo> {
    const url = joinUrl(this.options.baseUrl, key);
    const response = await davFetch(url, this.options, { method: 'HEAD' });
    if (!response.ok) {
      throw new Error(`WebDAV HEAD failed (${response.status})`);
    }
    const length = Number(response.headers.get('content-length') || '0');
    const lastModified = response.headers.get('last-modified') || undefined;
    return {
      key,
      sizeBytes: Number.isFinite(length) ? length : 0,
      lastModified,
    };
  }

  async list(prefix: string): Promise<BackupObjectInfo[]> {
    const url = joinUrl(this.options.baseUrl, prefix.replace(/\/?$/, '/'));
    const response = await davFetch(url, this.options, {
      method: 'PROPFIND',
      headers: {
        Depth: '1',
        'Content-Type': 'application/xml',
      },
      body: `<?xml version="1.0" encoding="utf-8" ?><propfind xmlns="DAV:"><prop><getcontentlength/><getlastmodified/></prop></propfind>`,
    });
    if (response.status === 404) return [];
    if (!response.ok) {
      throw new Error(`WebDAV PROPFIND failed (${response.status})`);
    }
    const xml = await response.text();
    return parsePropfind(xml, prefix);
  }

  async delete(key: string): Promise<void> {
    const url = joinUrl(this.options.baseUrl, key);
    const response = await davFetch(url, this.options, { method: 'DELETE' });
    if (!response.ok && response.status !== 404) {
      throw new Error(`WebDAV DELETE failed (${response.status})`);
    }
  }

  private async ensureParentCollections(key: string): Promise<void> {
    const parts = key.replace(/^\/+/, '').split('/').filter(Boolean);
    parts.pop();
    let current = '';
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      const response = await davFetch(joinUrl(this.options.baseUrl, current), this.options, {
        method: 'MKCOL',
      });
      if (
        response.ok ||
        response.status === 201 ||
        response.status === 405 ||
        response.status === 409 ||
        response.status === 301 ||
        response.status === 302
      ) {
        continue;
      }
    }
  }

  async test(): Promise<{ ok: true; detail: string }> {
    const probeKey = `_pai-probe-${Date.now()}.txt`;
    const tmp = path.join(
      await fs.mkdtemp(path.join(os.tmpdir(), 'pai-webdav-')),
      'probe.txt',
    );
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
      await fs.rm(path.dirname(tmp), { recursive: true, force: true });
    }
  }
}

function parsePropfind(xml: string, prefix: string): BackupObjectInfo[] {
  const items: BackupObjectInfo[] = [];
  const responses = xml.split(/<D:response\b|<response\b/i).slice(1);
  for (const block of responses) {
    const hrefMatch = block.match(/<(?:D:)?href[^>]*>([^<]+)</i);
    const lengthMatch = block.match(/<(?:D:)?getcontentlength[^>]*>(\d+)</i);
    const modifiedMatch = block.match(/<(?:D:)?getlastmodified[^>]*>([^<]+)</i);
    if (!hrefMatch) continue;
    let href = decodeURIComponent(hrefMatch[1].trim());
    if (href.endsWith('/')) continue;
    const key = href.split('/').filter(Boolean).slice(-1)[0];
    if (!key || key.startsWith('_pai-probe-')) continue;
    const prefixTail = prefix.replace(/\/+$/, '').split('/').pop() || '';
    if (prefixTail && !href.includes(prefixTail) && !key.startsWith('personal-ai-memory-')) {
      // keep objects that look like our backups even if href encoding differs
    }
    items.push({
      key: `${prefix.replace(/\/+$/, '')}/${key}`.replace(/^\//, ''),
      sizeBytes: lengthMatch ? Number(lengthMatch[1]) : 0,
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
