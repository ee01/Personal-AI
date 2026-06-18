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

  it('requires explicit confirmation before committing high-risk shadow memory', async () => {
    const payload = {
      text: 'Rotate api_key=abc and token=secret before sharing this note.',
      scope: 'work',
    };

    const blocked = await app.inject({
      method: 'POST',
      url: '/api/v1/import/commit',
      payload,
    });
    expect(blocked.statusCode).toBe(400);
    expect(blocked.json()).toMatchObject({
      error: 'High-risk import requires explicit confirmation before commit.',
    });
    expect(db.prepare('SELECT COUNT(*) AS count FROM messages_raw').get()).toMatchObject({
      count: 0,
    });

    const confirmed = await app.inject({
      method: 'POST',
      url: '/api/v1/import/commit',
      payload: {
        ...payload,
        confirmHighRisk: true,
      },
    });

    expect(confirmed.statusCode).toBe(200);
    expect(confirmed.json()).toMatchObject({
      status: 'committed',
      importedMessages: 1,
    });
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
    expect(result.summary.zipTotalFiles).toBe(2);
    expect(result.summary.zipInspectedFiles).toBe(2);
    expect(result.summary.zipSkippedFiles).toBe(0);
    expect(result.entries.find((entry) => entry.path.endsWith('.png'))).toMatchObject({
      status: 'blocked',
    });
  });

  it('reports ordinary zip inspection limits before commit', () => {
    const service = new SmartMemoryImportService(createUserContext(db));
    const entries: Record<string, string | Buffer> = {};
    for (let index = 0; index < 82; index += 1) {
      entries[`notes/note-${String(index).padStart(3, '0')}.md`] =
        `# Note ${index}\nNeed provenance before memory import.`;
    }

    const result = service.inspect({
      inputKind: 'file',
      fileName: 'large-notes.zip',
      buffer: createZipBuffer(entries),
    });

    expect(result.detectedKind).toBe('document_zip');
    expect(result.status).toBe('ready');
    expect(result.summary.files).toBe(80);
    expect(result.summary.readyFiles).toBe(80);
    expect(result.summary.zipTotalFiles).toBe(82);
    expect(result.summary.zipInspectedFiles).toBe(80);
    expect(result.summary.zipSkippedFiles).toBe(2);
    expect(result.warnings).toContain('Only inspected the first 80 entries.');
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
    expect(result.summary.externalAiImportedMessages).toBe(2);
    expect(result.summary.externalAiTotalMessages).toBe(2);
    expect(result.summary.externalAiTruncatedConversations).toBe(0);
    expect(result.summary.externalAiSourcePath).toBe('conversations.json');
    expect(result.summary.externalAiIgnoredFiles).toBe(0);
    expect(result.entries[0].title).toBe('Memory import discussion');
    expect(result.entries[0].preview).toContain('Source: chatgpt');
  });

  it('preserves ChatGPT mapping order and reports skipped non-text parts', () => {
    const service = new SmartMemoryImportService(createUserContext(db));
    const result = service.inspect({
      inputKind: 'file',
      fileName: 'chatgpt-visual-export.zip',
      buffer: createZipBuffer({
        'conversations.json': JSON.stringify([
          {
            title: 'ChatGPT visual thread',
            mapping: {
              assistant: {
                parent: 'user',
                children: [],
                message: {
                  author: { role: 'assistant' },
                  content: { parts: ['Second answer'] },
                },
              },
              root: {
                parent: null,
                children: ['user'],
              },
              user: {
                parent: 'root',
                children: ['assistant'],
                message: {
                  author: { role: 'user' },
                  content: {
                    parts: [
                      'First question',
                      {
                        content_type: 'image_asset_pointer',
                        asset_pointer: 'file-service://image.png',
                      },
                    ],
                  },
                },
              },
            },
          },
        ]),
      }),
    });

    expect(result.detectedKind).toBe('external_ai_history');
    expect(result.summary.externalAiSkippedParts).toBe(1);
    expect(result.summary.externalAiSourcePath).toBe('conversations.json');
    expect(result.summary.externalAiIgnoredFiles).toBe(0);
    expect(result.warnings).toContain(
      'Conversation "ChatGPT visual thread" skipped 1 non-text message parts or attachments.',
    );
    expect(result.entries[0].preview.indexOf('First question')).toBeLessThan(
      result.entries[0].preview.indexOf('Second answer'),
    );
    expect(result.entries[0].preview).not.toContain('image_asset_pointer');
  });

  it('reports external AI message truncation before import commit', () => {
    const service = new SmartMemoryImportService(createUserContext(db));
    const mapping = Object.fromEntries(
      Array.from({ length: 85 }, (_, index) => [
        `message-${index}`,
        {
          message: {
            author: { role: index % 2 === 0 ? 'user' : 'assistant' },
            create_time: index + 1,
            content: { parts: [`Long memory message ${index + 1}`] },
          },
        },
      ]),
    );

    const result = service.inspect({
      inputKind: 'file',
      fileName: 'long-chatgpt-export.zip',
      buffer: createZipBuffer({
        'conversations.json': JSON.stringify([
          {
            title: 'Long memory thread',
            mapping,
          },
        ]),
      }),
    });

    expect(result.detectedKind).toBe('external_ai_history');
    expect(result.summary.externalAiConversations).toBe(1);
    expect(result.summary.externalAiImportedMessages).toBe(80);
    expect(result.summary.externalAiTotalMessages).toBe(85);
    expect(result.summary.externalAiTruncatedConversations).toBe(1);
    expect(result.summary.externalAiTruncatedMessages).toBe(5);
    expect(result.summary.externalAiSourcePath).toBe('conversations.json');
    expect(result.warnings).toContain(
      'Conversation "Long memory thread" includes 85 messages; only the first 80 were included in this import preview.',
    );
  });

  it('parses Claude chat_messages content arrays as external AI history text', () => {
    const service = new SmartMemoryImportService(createUserContext(db));
    const result = service.inspect({
      inputKind: 'file',
      fileName: 'claude-export.zip',
      buffer: createZipBuffer({
        'conversations.json': JSON.stringify([
          {
            title: 'Claude requirements thread',
            chat_messages: [
              {
                role: 'user',
                content: [{ type: 'text', text: 'Please remember the dashboard scope.' }],
              },
              {
                role: 'assistant',
                content: [{ type: 'text', text: 'Dashboard scope remembered for review.' }],
              },
            ],
          },
        ]),
      }),
    });

    expect(result.detectedKind).toBe('external_ai_history');
    expect(result.summary.externalAiConversations).toBe(1);
    expect(result.summary.externalAiImportedMessages).toBe(2);
    expect(result.entries[0]).toMatchObject({
      title: 'Claude requirements thread',
      path: 'claude/1-claude-requirements-thread.md',
    });
    expect(result.entries[0].preview).toContain('Source: claude');
    expect(result.entries[0].preview).toContain('Please remember the dashboard scope.');
    expect(result.entries[0].preview).not.toContain('[object Object]');
  });

  it('detects external AI conversations.json before applying ordinary zip entry limits', () => {
    const service = new SmartMemoryImportService(createUserContext(db));
    const entries: Record<string, string | Buffer> = {};
    for (let index = 0; index < 90; index += 1) {
      entries[`attachments/filler-${String(index).padStart(3, '0')}.txt`] =
        `Attachment filler ${index}`;
    }
    entries['exports/conversations.json'] = JSON.stringify([
      {
        title: 'Late archive conversation',
        mapping: {
          user: {
            message: {
              author: { role: 'user' },
              create_time: 1,
              content: { parts: ['Remember this late conversations.json export.'] },
            },
          },
        },
      },
    ]);

    const result = service.inspect({
      inputKind: 'file',
      fileName: 'large-chatgpt-export.zip',
      buffer: createZipBuffer(entries),
    });

    expect(result.detectedKind).toBe('external_ai_history');
    expect(result.status).toBe('ready');
    expect(result.summary.externalAiConversations).toBe(1);
    expect(result.summary.unsupported).toBe(0);
    expect(result.summary.externalAiSourcePath).toBe('exports/conversations.json');
    expect(result.summary.externalAiIgnoredFiles).toBe(90);
    expect(result.entries[0]).toMatchObject({
      title: 'Late archive conversation',
      path: 'chatgpt/1-late-archive-conversation.md',
    });
    expect(result.warnings).toContain(
      'Detected external AI history from exports/conversations.json; ignored 90 other archive files.',
    );
  });

  it('persists external AI import scope metadata on commit', () => {
    const service = new SmartMemoryImportService(createUserContext(db));
    const input = {
      inputKind: 'file' as const,
      fileName: 'chatgpt-export-with-metadata.zip',
      buffer: createZipBuffer({
        'account/user.json': JSON.stringify({ email: 'user@example.com' }),
        'conversations.json': JSON.stringify([
          {
            title: 'Scope receipt thread',
            mapping: {
              user: {
                message: {
                  author: { role: 'user' },
                  create_time: 1,
                  content: { parts: ['Only conversations should become memory.'] },
                },
              },
            },
          },
        ]),
      }),
    };

    const committed = service.commit(input);
    expect(committed.status).toBe('committed');

    const row = db
      .prepare(
        `SELECT summary_json
         FROM memory_import_batches
         WHERE detected_kind = 'external_ai_history'
         LIMIT 1`,
      )
      .get() as { summary_json: string };
    expect(JSON.parse(row.summary_json)).toMatchObject({
      externalAiSourcePath: 'conversations.json',
      externalAiIgnoredFiles: 1,
      externalAiConversations: 1,
      externalAiImportedMessages: 1,
    });
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
    expect(result.summary.zipTotalFiles).toBe(93);
    expect(result.summary.zipInspectedFiles).toBe(93);
    expect(result.summary.zipSkippedFiles).toBe(0);
    expect(result.warnings).not.toContain('Only inspected the first 80 entries.');
  });
});
