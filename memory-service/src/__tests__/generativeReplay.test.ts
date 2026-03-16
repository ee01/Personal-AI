import { beforeEach, describe, expect, it } from 'vitest';

import { GenerativeReplay } from '../core/GenerativeReplay.js';
import { getTestDb } from './setup.js';

describe('GenerativeReplay', () => {
  const db = getTestDb();

  beforeEach(() => {
    db.prepare('DELETE FROM memory_metadata').run();
    db.prepare('DELETE FROM relationships').run();
    db.prepare('DELETE FROM entities').run();
  });

  it('selects entity topics even when higher-salience messages exist', () => {
    const currentTime = Math.floor(Date.now() / 1000);

    db.prepare(
      `INSERT INTO entities
        (id, type, name, importance, mention_count, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
    ).run('entity-project-orbit', 'Project', 'Project Orbit', 0.9, 4, currentTime, currentTime);

    db.prepare(
      `INSERT INTO memory_metadata
        (target_type, target_id, salience_score, importance, frequency, recency_boost, consolidation_level, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run('message', 'demo-msg-1', 5.0, 0.9, 3, 1.2, 'temporary', currentTime, currentTime);

    db.prepare(
      `INSERT INTO memory_metadata
        (target_type, target_id, salience_score, importance, frequency, recency_boost, consolidation_level, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run('entity', 'entity-project-orbit', 0.95, 0.9, 2, 1.1, 'working', currentTime, currentTime);

    const replay = new GenerativeReplay(db);
    const topics = (replay as any).selectSalientTopics() as Array<{ target_id: string; entity_name: string }>;

    expect(topics).toHaveLength(1);
    expect(topics[0].target_id).toBe('entity-project-orbit');
    expect(topics[0].entity_name).toBe('Project Orbit');
  });
});
