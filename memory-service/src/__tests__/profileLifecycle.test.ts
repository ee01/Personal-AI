import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type BetterSqlite3 from 'better-sqlite3';

import { ProfileManager } from '../core/ProfileManager.js';
import { cleanupTestDb, getTestDb } from './setup.js';

let db: BetterSqlite3.Database;

function insertProfileItem(overrides: {
  id: string;
  itemType: string;
  itemKey: string;
  itemValue: string;
  userConfirmed: number;
  salienceScore: number;
  status?: string;
}): void {
  const ts = Math.floor(Date.now() / 1000);
  db.prepare(
    `INSERT INTO user_profile_items
      (id, item_type, item_key, item_value, evidence_refs, source_kind,
       confidence, user_confirmed, status, salience_score, mention_count,
       last_seen, created_at, updated_at, fingerprint)
     VALUES (?, ?, ?, ?, '[]', 'inferred', 0.8, ?, ?, ?, 1, ?, ?, ?, ?)`,
  ).run(
    overrides.id,
    overrides.itemType,
    overrides.itemKey,
    overrides.itemValue,
    overrides.userConfirmed,
    overrides.status ?? 'active',
    overrides.salienceScore,
    ts,
    ts,
    ts,
    `${overrides.itemKey}:${overrides.itemValue}`,
  );
}

describe('profile lifecycle rendering', () => {
  beforeAll(() => {
    db = getTestDb();
  });

  beforeEach(() => {
    db.prepare('DELETE FROM user_profile_items').run();
    db.prepare('DELETE FROM social_edges').run();
  });

  afterAll(() => {
    cleanupTestDb();
  });

  it('keeps unconfirmed and low-salience profile items out of USER_CORE', () => {
    insertProfileItem({
      id: 'confirmed-preference',
      itemType: 'preference',
      itemKey: 'communication_style',
      itemValue: 'direct and practical',
      userConfirmed: 1,
      salienceScore: 0.8,
    });
    insertProfileItem({
      id: 'unconfirmed-preference',
      itemType: 'preference',
      itemKey: 'food',
      itemValue: 'prefers spicy lunch',
      userConfirmed: 0,
      salienceScore: 0.9,
    });
    insertProfileItem({
      id: 'stale-interest',
      itemType: 'interest',
      itemKey: 'temporary_topic',
      itemValue: 'old one-off topic',
      userConfirmed: 1,
      salienceScore: 0.05,
    });

    const content = new ProfileManager(db).renderUserCore(20);

    expect(content).toContain('direct and practical');
    expect(content).not.toContain('prefers spicy lunch');
    expect(content).not.toContain('old one-off topic');
  });
});
