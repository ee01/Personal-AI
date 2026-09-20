import type Database from 'better-sqlite3';

import type { UiLanguage } from '../i18n.js';

const ENGLISH_PREFERENCE_RE = /english|英文|en-us|\ben\b/i;

export function resolveOutputLanguage(db: Database.Database): UiLanguage {
  const row = db
    .prepare(
      `SELECT item_value
       FROM user_profile_items
       WHERE status = 'active' AND item_key = 'language_preference'
       ORDER BY user_confirmed DESC, updated_at DESC
       LIMIT 1`,
    )
    .get() as { item_value: string } | undefined;
  return ENGLISH_PREFERENCE_RE.test(row?.item_value || '') ? 'en-US' : 'zh-CN';
}

export function outputLanguageLabel(language: UiLanguage): string {
  return language === 'en-US' ? 'English' : 'Simplified Chinese';
}
