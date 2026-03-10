import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../llm/EmbeddingClient.js', () => ({
  EmbeddingClient: {
    getInstance: vi.fn().mockRejectedValue(new Error('Embedding not available in tests')),
  },
}));

import { MarkdownManager } from '../core/MarkdownManager.js';
import { getTestDb } from './setup.js';

describe('MarkdownManager', () => {
  const db = getTestDb();
  let tempDir: string;
  let manager: MarkdownManager;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'personal-ai-md-'));
    manager = new MarkdownManager(db, tempDir);
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    db.prepare(`DELETE FROM chunks WHERE file_path = 'USER_CORE.md'`).run();
    fs.writeFileSync(
      path.join(tempDir, 'USER_CORE.md'),
      '# USER_CORE\n\n## Preferences\n- Prefers concise answers.\n',
      'utf-8',
    );
  });

  it('reindexes USER_CORE.md with the dedicated source type', async () => {
    const count = await manager.reindexFile('USER_CORE.md');

    expect(count).toBeGreaterThan(0);

    const rows = db
      .prepare(
        `SELECT file_path, source_type
         FROM chunks
         WHERE file_path = ?`,
      )
      .all('USER_CORE.md') as Array<{ file_path: string; source_type: string }>;

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.file_path === 'USER_CORE.md')).toBe(true);
    expect(rows.every((row) => row.source_type === 'user_core')).toBe(true);
  });
});
