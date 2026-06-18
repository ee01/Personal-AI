import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const recallMock = vi.fn();

vi.mock('../core/RecallEngine.js', () => ({
  RecallEngine: vi.fn().mockImplementation(() => ({
    recall: recallMock,
  })),
}));

vi.mock('../llm/LLMClient.js', () => ({
  getLLMClient: () => ({
    generateJSON: vi.fn().mockResolvedValue({
      narrative: 'dream narrative',
      newRelationships: [],
      insights: [],
      risks: [],
    }),
  }),
}));

import { GenerativeReplay } from '../core/GenerativeReplay.js';
import { UserDataManager } from '../storage/UserDataManager.js';
import { getTestDb } from './setup.js';

describe('GenerativeReplay', () => {
  const db = getTestDb();
  const tempDirs: string[] = [];

  beforeEach(() => {
    recallMock.mockReset();
    recallMock.mockResolvedValue({ items: [], totalFound: 0, channels: [] });
    db.prepare('DELETE FROM memory_metadata').run();
    db.prepare('DELETE FROM relationships').run();
    db.prepare('DELETE FROM entities').run();
  });

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('selects entity topics even when higher-salience messages exist', () => {
    const currentTime = Math.floor(Date.now() / 1000);

    db.prepare(
      `INSERT INTO entities
        (id, type, name, importance, mention_count, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
    ).run(
      'entity-project-orbit',
      'Project',
      'Project Orbit',
      0.9,
      4,
      currentTime,
      currentTime,
    );

    db.prepare(
      `INSERT INTO memory_metadata
        (target_type, target_id, salience_score, importance, frequency, recency_boost, consolidation_level, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'message',
      'demo-msg-1',
      5.0,
      0.9,
      3,
      1.2,
      'temporary',
      currentTime,
      currentTime,
    );

    db.prepare(
      `INSERT INTO memory_metadata
        (target_type, target_id, salience_score, importance, frequency, recency_boost, consolidation_level, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'entity',
      'entity-project-orbit',
      0.95,
      0.9,
      2,
      1.1,
      'working',
      currentTime,
      currentTime,
    );

    const replay = new GenerativeReplay(db);
    const topics = (replay as any).selectSalientTopics() as Array<{
      target_id: string;
      entity_name: string;
    }>;

    expect(topics).toHaveLength(1);
    expect(topics[0].target_id).toBe('entity-project-orbit');
    expect(topics[0].entity_name).toBe('Project Orbit');
  });

  it('excludes meeting records from default dream recall', async () => {
    const currentTime = Math.floor(Date.now() / 1000);

    db.prepare(
      `INSERT INTO entities
        (id, type, name, importance, mention_count, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
    ).run(
      'entity-topic-1',
      'Topic',
      'Meeting Pilot',
      0.9,
      4,
      currentTime,
      currentTime,
    );

    db.prepare(
      `INSERT INTO memory_metadata
        (target_type, target_id, salience_score, importance, frequency, recency_boost, consolidation_level, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'entity',
      'entity-topic-1',
      1.2,
      0.9,
      2,
      1.1,
      'working',
      currentTime,
      currentTime,
    );

    const replay = new GenerativeReplay(db);
    const result = await replay.runWeeklyDreaming();

    expect(recallMock).toHaveBeenCalled();
    expect(recallMock.mock.calls[0][0].sourceTypes).toEqual([
      'glip',
      'jira',
      'web',
      'manual',
      'system',
    ]);
    expect(result.totalTopics).toBe(1);
  });

  it('reinforces dream recall results with their explicit result type', async () => {
    const currentTime = Math.floor(Date.now() / 1000);

    db.prepare(
      `INSERT INTO entities
        (id, type, name, importance, mention_count, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
    ).run(
      'entity-project-orbit',
      'Project',
      'Project Orbit',
      0.9,
      4,
      currentTime,
      currentTime,
    );

    db.prepare(
      `INSERT INTO memory_metadata
        (target_type, target_id, salience_score, importance, frequency, recency_boost, consolidation_level, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'entity',
      'entity-project-orbit',
      1.2,
      0.9,
      2,
      1.1,
      'working',
      currentTime,
      currentTime,
    );

    recallMock.mockResolvedValue({
      items: [
        {
          id: '1234567890',
          type: 'message',
          content: 'Numeric RingCentral message id should stay a message.',
          score: 0.92,
          metadata: { channels: ['fts', 'graph'] },
        },
      ],
      totalFound: 1,
      channels: ['fts'],
    });

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dream-replay-'));
    tempDirs.push(tempDir);
    const userDataManager = new UserDataManager();
    userDataManager.initialize(tempDir);

    const replay = new GenerativeReplay(db, userDataManager);
    const result = await replay.runWeeklyDreaming();

    expect(result.dreams).toHaveLength(1);
    expect(recallMock).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'Project Orbit' }),
      { reinforceAccess: false },
    );

    const messageMeta = db
      .prepare(
        `SELECT target_type, target_id, access_count
         FROM memory_metadata
         WHERE target_type = 'message' AND target_id = ?`,
      )
      .get('1234567890') as
      | { target_type: string; target_id: string; access_count: number }
      | undefined;
    const chunkMeta = db
      .prepare(
        `SELECT target_type
         FROM memory_metadata
         WHERE target_type = 'chunk' AND target_id = ?`,
      )
      .get('1234567890');

    expect(messageMeta).toMatchObject({
      target_type: 'message',
      target_id: '1234567890',
      access_count: 1,
    });
    expect(chunkMeta).toBeUndefined();

    const dreamFiles = userDataManager.listFiles('dreams');
    expect(dreamFiles).toHaveLength(1);
    const dreamFile = userDataManager.readFile(`dreams/${dreamFiles[0]}`);
    expect(dreamFile).toContain('## Grounding Receipt');
    expect(dreamFile).toContain('- Recalled memories: 1');
    expect(dreamFile).toContain('- Recall result types: message 1');
    expect(dreamFile).toContain('- Recall hit channels: fts, graph');
    expect(dreamFile).toContain('- Recall checked channels: fts');
    expect(dreamFile).toContain(
      '- message:1234567890 — Numeric RingCentral message id should stay a message.',
    );
  });
});
