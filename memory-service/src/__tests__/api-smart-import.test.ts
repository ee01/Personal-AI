import AdmZip from 'adm-zip';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type BetterSqlite3 from 'better-sqlite3';

import { buildApp } from '../server.js';
import { getTestDb } from './setup.js';
import { SmartMemoryImportService } from '../core/SmartMemoryImportService.js';

const TABLES_TO_CLEAR = [
  'memory_import_batches',
  'memory_metadata',
  'chunks',
  'messages_raw',
];

function clearImportTables(db: BetterSqlite3.Database): void {
  for (const table of TABLES_TO_CLEAR) {
    try {
      db.prepare(`DELETE FROM ${table}`).run();
    } catch {
      // Optional tables can be absent in older local migration snapshots.
    }
  }
}

function createUserContext(db: BetterSqlite3.Database): any {
  return {
    userId: 'smart-import-test',
    db,
  };
}

function createZipBuffer(entries: Record<string, string | Buffer>): Buffer {
  const zip = new AdmZip();
  for (const [name, content] of Object.entries(entries)) {
    zip.addFile(name, Buffer.isBuffer(content) ? content : Buffer.from(content));
  }
  return zip.toBuffer();
}

function createSimplePdfBuffer(text: string): Buffer {
  return Buffer.from(
    `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT /F1 12 Tf 72 720 Td (${text}) Tj ET
endstream
endobj
trailer
<< /Root 1 0 R >>
%%EOF`,
    'latin1',
  );
}

describe('Smart Memory Import API', () => {
  let app: FastifyInstance;
  let db: BetterSqlite3.Database;

  beforeAll(async () => {
    db = getTestDb();
    const result = await buildApp({ db });
    app = result.app;
    await app.ready();
  });

  beforeEach(() => {
    clearImportTables(db);
  });

  afterAll(async () => {
    await app.close();
  });

  it('inspects pasted text without writing memory rows', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/import/inspect',
      payload: {
        text:
          '我喜欢在产品计划里先看到明确 provenance。这个 skill 应该沉淀成会议 follow-up 检查清单。',
        scope: 'work',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.detectedKind).toBe('text');
    expect(body.status).toBe('ready');
    expect(body.summary.chunks).toBeGreaterThan(0);
    expect(body.summary.skillSignals).toBeGreaterThan(0);
    expect(db.prepare('SELECT COUNT(*) AS count FROM messages_raw').get()).toMatchObject({
      count: 0,
    });
  });

  it('commits pasted text as low-weight searchable shadow memory and dedupes repeats', async () => {
    const payload = {
      text:
        'Project Alpha 需要在下周整理 AI 记忆覆盖地图。偏好：导入前必须 dry-run，并保留来源。',
      scope: 'personal',
    };

    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/import/commit',
      payload,
    });
    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/import/commit',
      payload,
    });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(first.json()).toMatchObject({
      status: 'committed',
      importedMessages: 1,
    });
    expect(second.json()).toMatchObject({
      status: 'duplicate',
      importedMessages: 0,
    });

    const message = db
      .prepare(
        `SELECT source_type, scope, sender, metadata_json
         FROM messages_raw
         WHERE sender = 'memory-import'
         LIMIT 1`,
      )
      .get() as any;
    expect(message).toMatchObject({
      source_type: 'manual',
      scope: 'personal',
      sender: 'memory-import',
    });
    expect(JSON.parse(message.metadata_json)).toMatchObject({
      shadowMemory: true,
      lowWeight: true,
    });

    const chunkCount = db
      .prepare(`SELECT COUNT(*) AS count FROM chunks WHERE source_type = 'manual'`)
      .get() as { count: number };
    expect(chunkCount.count).toBeGreaterThan(0);
  });

  it('detects ordinary document zip and blocks unsupported entries explicitly', () => {
    const service = new SmartMemoryImportService(createUserContext(db));
    const result = service.inspect({
      inputKind: 'file',
      fileName: 'notes.zip',
      buffer: createZipBuffer({
        'notes/context.md': '# Context\n需要记住客户偏好和 meeting skill。',
        'assets/photo.png': Buffer.from([1, 2, 3]),
      }),
    });

    expect(result.detectedKind).toBe('document_zip');
    expect(result.status).toBe('ready');
    expect(result.summary.readyFiles).toBe(1);
    expect(result.summary.unsupported).toBe(1);
    expect(result.entries.find((entry) => entry.path.endsWith('.png'))).toMatchObject({
      status: 'blocked',
    });
  });

  it('blocks an empty standalone text file before commit', () => {
    const service = new SmartMemoryImportService(createUserContext(db));
    const input = {
      inputKind: 'file' as const,
      fileName: 'blank-notes.txt',
      buffer: Buffer.from(' \n\t '),
    };
    const result = service.inspect(input);

    expect(result.detectedKind).toBe('text');
    expect(result.status).toBe('blocked');
    expect(result.summary.readyFiles).toBe(0);
    expect(result.summary.unsupported).toBe(1);
    expect(result.entries[0]).toMatchObject({
      kind: 'text',
      status: 'blocked',
      blockedReason: 'Text file is empty.',
    });
    expect(result.warnings).toContain('Text file is empty.');
    expect(() => service.commit(input)).toThrow('No supported text entries');
    expect(db.prepare('SELECT COUNT(*) AS count FROM messages_raw').get()).toMatchObject({
      count: 0,
    });
  });

  it('extracts readable PDF text with the built-in best-effort parser', () => {
    const service = new SmartMemoryImportService(createUserContext(db));
    const result = service.inspect({
      inputKind: 'file',
      fileName: 'meeting-notes.pdf',
      buffer: createSimplePdfBuffer('User prefers dry-run before import.'),
    });

    expect(result.detectedKind).toBe('document');
    expect(result.status).toBe('ready');
    expect(result.entries[0]).toMatchObject({
      kind: 'pdf',
      status: 'ready',
    });
    expect(result.entries[0].preview).toContain('dry-run');
  });

  it('recognizes ChatGPT conversations.json exports as external AI history', () => {
    const service = new SmartMemoryImportService(createUserContext(db));
    const result = service.inspect({
      inputKind: 'file',
      fileName: 'chatgpt-export.zip',
      buffer: createZipBuffer({
        'conversations.json': JSON.stringify([
          {
            title: 'Memory import discussion',
            mapping: {
              a: {
                message: {
                  author: { role: 'user' },
                  create_time: 1,
                  content: { parts: ['Please remember my workflow preference.'] },
                },
              },
              b: {
                message: {
                  author: { role: 'assistant' },
                  create_time: 2,
                  content: { parts: ['Use dry-run before committing memory.'] },
                },
              },
            },
          },
        ]),
      }),
    });

    expect(result.detectedKind).toBe('external_ai_history');
    expect(result.status).toBe('ready');
    expect(result.summary.externalAiConversations).toBe(1);
    expect(result.entries[0].title).toBe('Memory import discussion');
    expect(result.entries[0].preview).toContain('Source: chatgpt');
  });

  it('detects Personal AI backup zip so the UI can switch to restore mode', () => {
    const service = new SmartMemoryImportService(createUserContext(db));
    const result = service.inspect({
      inputKind: 'file',
      fileName: 'personal-ai-memory.zip',
      buffer: createZipBuffer({
        'manifest.json': JSON.stringify({
          format: 'personal-ai-memory-backup',
          transport: 'zip',
        }),
        'user/memory.db': Buffer.from('sqlite placeholder'),
        'user/config.json': '{}',
      }),
    });

    expect(result.detectedKind).toBe('backup_zip');
    expect(result.status).toBe('backup');
    expect(result.backup).toMatchObject({
      suggestedMode: 'merge',
      replaceRequiresConfirm: true,
    });
  });

  it('detects large Personal AI backup zip before applying document entry limits', () => {
    const service = new SmartMemoryImportService(createUserContext(db));
    const entries: Record<string, string | Buffer> = {
      'manifest.json': JSON.stringify({
        format: 'personal-ai-memory-backup',
        transport: 'zip',
      }),
      'user/config.json': '{}',
    };
    for (let index = 0; index < 90; index += 1) {
      entries[`user/entities/entity-${String(index).padStart(3, '0')}.md`] =
        `# Entity ${index}`;
    }
    entries['user/memory.db'] = Buffer.from('sqlite placeholder');

    const result = service.inspect({
      inputKind: 'file',
      fileName: 'large-personal-ai-memory.zip',
      buffer: createZipBuffer(entries),
    });

    expect(result.detectedKind).toBe('backup_zip');
    expect(result.status).toBe('backup');
    expect(result.warnings).toContain('Only inspected the first 80 entries.');
  });
});
