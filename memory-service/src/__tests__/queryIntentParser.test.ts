import { beforeEach, describe, expect, it } from 'vitest';

import { QueryIntentParser } from '../core/QueryIntentParser.js';
import { getTestDb } from './setup.js';

describe('QueryIntentParser', () => {
  const db = getTestDb();
  const parser = new QueryIntentParser(db);

  beforeEach(() => {
    db.prepare('DELETE FROM messages_raw').run();
    db.prepare('DELETE FROM watched_projects').run();
    db.prepare('DELETE FROM entities').run();

    const timestamp = Math.floor(Date.now() / 1000);
    db.prepare(
      `INSERT INTO messages_raw
        (id, content, source_type, sender, group_name, timestamp, importance, sentiment, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'msg-query-parser',
      'John shared a Glip update in DevOps.',
      'glip',
      'John',
      'DevOps',
      timestamp,
      0.9,
      'neutral',
      timestamp,
    );

    db.prepare(
      `INSERT INTO watched_projects
        (id, name, aliases_json, is_active, priority, created_at)
       VALUES (?, ?, ?, 1, ?, ?)`,
    ).run('personal-ai', 'Personal AI', JSON.stringify(['PAI']), 10, timestamp);

    db.prepare(
      `INSERT INTO entities
        (id, type, name, aliases_json, importance, mention_count, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run('entity-john', 'Person', 'John', JSON.stringify(['Johnny']), 0.9, 3, 'active', timestamp);
  });

  it('extracts sender, group, project, source, importance, and Chinese time range', () => {
    const result = parser.parse('最近三天在 DevOps 群里 John 说过哪些关于 PAI 的重要 Glip 消息？');

    expect(result.intent).toBe('timeline');
    expect(result.filters.senderNames).toEqual(['John']);
    expect(result.filters.groupNames).toEqual(['DevOps']);
    expect(result.filters.projectNames).toEqual(['Personal AI']);
    expect(result.filters.sourceTypes).toEqual(['glip']);
    expect(result.filters.minImportance).toBe(0.7);
    expect(result.filters.entityNames).toContain('John');
    expect(result.filters.timeRange).toBeDefined();
  });

  it('detects profile-oriented questions', () => {
    const result = parser.parse('我的工作偏好是什么？');
    expect(result.intent).toBe('profile');
  });
});
