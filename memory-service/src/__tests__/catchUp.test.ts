/**
 * Tests for P1-7 CatchUpService: read-only window brief, ranking, waiting
 * detection, and exclusion of forgotten/archived memories.
 */

import { getTestDb, cleanupTestDb } from './setup.js';
import { CatchUpService } from '../core/CatchUpService.js';
import type Database from 'better-sqlite3';

let db: Database.Database;

function insertMessage(
  id: string,
  content: string,
  timestamp: number,
  importance: number,
): void {
  db.prepare(
    `INSERT INTO messages_raw (id, content, source_type, source_title, timestamp, importance, created_at)
     VALUES (?, ?, 'ringcentral', ?, ?, ?, ?)`,
  ).run(id, content, `t-${id}`, timestamp, importance, timestamp);
}

beforeAll(() => {
  db = getTestDb();
});
afterAll(() => {
  cleanupTestDb();
});
beforeEach(() => {
  db.prepare('DELETE FROM messages_raw').run();
  db.prepare('DELETE FROM memory_metadata').run();
});

describe('CatchUpService', () => {
  it('ranks recent items by importance and flags waiting items', () => {
    const nowTs = 1_000_000;
    const since = nowTs - 3600;
    insertMessage('a', '客户改了导出需求，需要尽快确认', since + 100, 0.9);
    insertMessage('b', 'FYI 周报已发', since + 200, 0.3);
    insertMessage('c', '@你 这个能今天回我吗？', since + 300, 0.7);
    // Outside the window — must be excluded.
    insertMessage('old', '昨天的旧消息', since - 7200, 0.95);

    const brief = new CatchUpService(db).buildCatchUp(since, nowTs);
    expect(brief.total).toBe(3);
    expect(brief.highPriority[0].messageId).toBe('a'); // highest importance
    expect(brief.waiting.some((i) => i.messageId === 'c')).toBe(true); // @ + ?
  });

  it('excludes forgotten / archived memories', () => {
    const nowTs = 2_000_000;
    const since = nowTs - 3600;
    insertMessage('keep', '重要进展', since + 50, 0.8);
    insertMessage('gone', '已归档内容', since + 60, 0.8);
    db.prepare(
      `INSERT INTO memory_metadata (target_type, target_id, retrieval_tier, created_at)
       VALUES ('message', 'gone', 'archive_only', ?)`,
    ).run(since);

    const brief = new CatchUpService(db).buildCatchUp(since, nowTs);
    expect(brief.total).toBe(1);
    expect(brief.highPriority[0].messageId).toBe('keep');
  });
});
