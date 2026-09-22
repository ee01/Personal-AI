import { describe, expect, it } from 'vitest';

import { resolveOutputLanguage } from '../utils/outputLanguage.js';
import { getTestDb } from './setup.js';

function insertPreference(options: {
  id: string;
  value: string;
  status?: string;
  userConfirmed?: number;
  updatedAt: number;
}): void {
  const db = getTestDb();
  db.prepare(
    `INSERT INTO user_profile_items
      (id, item_type, item_key, item_value, evidence_refs, source_kind,
       confidence, user_confirmed, status, salience_score, mention_count,
       last_seen, valid_from, valid_to, created_at, updated_at, fingerprint)
     VALUES
      (?, 'preference', 'language_preference',
       ?, '[]', 'explicit',
       1, ?, ?, 1, 1, ?, NULL, NULL, ?, ?, ?)`,
  ).run(
    options.id,
    options.value,
    options.userConfirmed ?? 1,
    options.status ?? 'active',
    options.updatedAt,
    options.updatedAt,
    options.updatedAt,
    `${options.id}-fp`,
  );
}

describe('resolveOutputLanguage', () => {
  const db = getTestDb();

  it('defaults to zh-CN when no active language preference exists', () => {
    db.prepare("DELETE FROM user_profile_items WHERE item_key = 'language_preference'").run();
    expect(resolveOutputLanguage(db)).toBe('zh-CN');
  });

  it('treats the canonical Chinese Options value as zh-CN', () => {
    db.prepare("DELETE FROM user_profile_items WHERE item_key = 'language_preference'").run();
    insertPreference({
      id: 'lang-zh',
      value: '回复和生成面向用户的内容时使用中文',
      updatedAt: 100,
    });
    expect(resolveOutputLanguage(db)).toBe('zh-CN');
  });

  it('treats the canonical English Options value as en-US', () => {
    db.prepare("DELETE FROM user_profile_items WHERE item_key = 'language_preference'").run();
    insertPreference({
      id: 'lang-en',
      value: 'Reply and generate user-facing content in English.',
      updatedAt: 100,
    });
    expect(resolveOutputLanguage(db)).toBe('en-US');
  });

  it('ignores retracted preferences and prefers confirmed rows', () => {
    db.prepare("DELETE FROM user_profile_items WHERE item_key = 'language_preference'").run();
    insertPreference({
      id: 'lang-en-old',
      value: 'Reply and generate user-facing content in English.',
      status: 'retracted',
      userConfirmed: 1,
      updatedAt: 300,
    });
    insertPreference({
      id: 'lang-zh-confirmed',
      value: '回复和生成面向用户的内容时使用中文',
      userConfirmed: 1,
      updatedAt: 100,
    });
    insertPreference({
      id: 'lang-en-unconfirmed',
      value: 'Reply and generate user-facing content in English.',
      userConfirmed: 0,
      updatedAt: 200,
    });
    expect(resolveOutputLanguage(db)).toBe('zh-CN');
  });
});
