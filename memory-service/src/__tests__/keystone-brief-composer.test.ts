import { beforeEach, describe, expect, it } from 'vitest';
import type BetterSqlite3 from 'better-sqlite3';

import { KeystoneBriefComposerService } from '../core/KeystoneBriefComposerService.js';
import { KeystoneBriefService } from '../core/KeystoneBriefService.js';
import { now } from '../utils/time.js';
import { getTestDb } from './setup.js';

function resetTables(db: BetterSqlite3.Database): void {
  db.prepare('DELETE FROM keystone_brief_events').run();
  db.prepare('DELETE FROM keystone_brief_candidate_runs').run();
  db.prepare('DELETE FROM keystone_brief_sources').run();
  db.prepare('DELETE FROM keystone_briefs').run();
  db.prepare('DELETE FROM topic_memory_links').run();
  db.prepare('DELETE FROM reflection_runs').run();
  db.prepare('DELETE FROM reflection_threads').run();
  db.prepare("DELETE FROM messages_raw WHERE id LIKE 'composer-%'").run();
  db.prepare("DELETE FROM user_profile_items WHERE id LIKE 'composer-%'").run();
}

const preserveLocalizedContent = async <T extends {
  summary: string;
  claims: string[];
  openQuestions: string[];
}>(input: T) => ({
  summary: input.summary,
  claims: input.claims,
  openQuestions: input.openQuestions,
});

function seedWhatsAppTopic(db: BetterSqlite3.Database): void {
  const timestamp = now();
  db.prepare(
    `INSERT INTO reflection_threads
      (id, topic_key, title, status, priority, salience, source_type,
       current_hypothesis, open_questions_json, latest_summary,
       created_at, updated_at)
     VALUES (?, ?, ?, 'active', 9, 0.9, 'message', ?, ?, ?, ?, ?)`,
  ).run(
    'composer-thread-whatsapp',
    'workflow:whatsapp',
    'Reflection Thread: WhatsApp 集成复用路径',
    'RingCX WhatsApp 应优先核对现有 SMS 基础设施。',
    JSON.stringify(['Provider 能力边界是否已确认？']),
    '近期讨论都指向先复用 SMS，再决定是否新增发送链路。',
    timestamp - 7200,
    timestamp - 60,
  );

  const insertMessage = db.prepare(
    `INSERT INTO messages_raw
      (id, content, summary, source_type, source_url, source_title, sender,
       group_id, group_name, timestamp, importance, metadata_json, scope, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'work', ?)`,
  );
  insertMessage.run(
    'composer-msg-1',
    'RingCX WhatsApp integration should reuse the existing SMS infrastructure before a second delivery path is designed.',
    '先核对并复用 SMS 基础设施。',
    'glip',
    'https://app.ringcentral.com/messages/160443817990',
    'Nova CA - Brandy',
    'Alice',
    '160443817990',
    'Nova CA - Brandy',
    timestamp - 3600,
    0.9,
    '{}',
    timestamp - 3600,
  );
  insertMessage.run(
    'composer-msg-2',
    'The WhatsApp provider boundary is still open, so the team should research the current RingCX SMS path first.',
    'Provider 边界未确认，先调研现有链路。',
    'web',
    'https://example.com/ringcx-whatsapp-notes',
    'RingCX architecture notes',
    'Bob',
    null,
    null,
    timestamp - 1800,
    0.8,
    '{}',
    timestamp - 1800,
  );
}

describe('KeystoneBriefComposerService', () => {
  let db: BetterSqlite3.Database;

  beforeEach(() => {
    db = getTestDb();
    resetTables(db);
    seedWhatsAppTopic(db);
  });

  it('automatically composes a ready source-grounded brief and skips unchanged evidence', async () => {
    const composer = new KeystoneBriefComposerService(db, preserveLocalizedContent);
    const first = await composer.run({ maxBriefs: 2 });

    expect(first).toMatchObject({ composed: 1, ready: 1, failed: 0 });
    const brief = new KeystoneBriefService(db).list({ limit: 10 })[0];
    expect(brief).toMatchObject({
      briefKey: 'workflow:whatsapp',
      status: 'ready',
      compositionVersion: 'auto-reflection-grounded-v2-zh-CN',
      sceneAnchors: {
        topics: ['WhatsApp'],
        surfaces: ['ringcentral_thread_reading', 'web_reading'],
      },
    });
    expect(brief.sourceMap).toHaveLength(2);
    expect(brief.slots.stableFacts).toHaveLength(2);

    const second = await composer.run({ maxBriefs: 2 });
    expect(second).toMatchObject({ composed: 0, failed: 0 });
    expect(second.skippedUnchanged).toBeGreaterThanOrEqual(1);
  });

  it('does not recreate a brief after the user hides it', async () => {
    const composer = new KeystoneBriefComposerService(db, preserveLocalizedContent);
    await composer.run({ maxBriefs: 1 });
    const briefService = new KeystoneBriefService(db);
    const brief = briefService.list({ limit: 1 })[0];
    briefService.recordEvent(brief.id, {
      eventType: 'hidden',
      surface: 'memory_lens',
    });

    db.prepare(
      `UPDATE messages_raw
       SET content = content || ' New WhatsApp evidence.', updated_at = ?
       WHERE id = 'composer-msg-2'`,
    ).run(now());
    const result = await composer.run({ maxBriefs: 1 });

    expect(result).toMatchObject({ composed: 0, skippedProtected: 1 });
    expect(briefService.getById(brief.id)?.status).toBe('hidden');
  });

  it('does not mistake model names for Jira issues without a Jira source anchor', async () => {
    resetTables(db);
    const timestamp = now();
    db.prepare(
      `INSERT INTO reflection_threads
        (id, topic_key, title, status, priority, salience, latest_summary,
         created_at, updated_at)
       VALUES ('composer-thread-model', 'topic:glm-5', 'Reflection Thread: GLM-5',
               'active', 9, 0.9, 'GLM-5 model usage and cost discussion.', ?, ?)`,
    ).run(timestamp - 120, timestamp);
    const insert = db.prepare(
      `INSERT INTO messages_raw
        (id, content, summary, source_type, timestamp, importance, scope, created_at)
       VALUES (?, ?, ?, 'glip', ?, 0.8, 'work', ?)`,
    );
    insert.run(
      'composer-model-1',
      'The team discussed GLM-5 model pricing and latency in the AI tools room.',
      'GLM-5 model pricing is higher than the previous model.',
      timestamp - 60,
      timestamp - 60,
    );
    insert.run(
      'composer-model-2',
      'A second message compared GLM-5 model quality with other providers.',
      'GLM-5 model quality needs more evaluation before adoption.',
      timestamp - 30,
      timestamp - 30,
    );

    const result = await new KeystoneBriefComposerService(
      db,
      preserveLocalizedContent,
    ).run({ maxBriefs: 2 });

    expect(result.composed).toBe(0);
    expect(new KeystoneBriefService(db).list({ limit: 10 })).toHaveLength(0);
  });

  it('uses the Options language preference and refreshes an unchanged brief after language changes', async () => {
    const seenLanguages: string[] = [];
    const composer = new KeystoneBriefComposerService(db, async (input) => {
      seenLanguages.push(input.language);
      return {
        summary: input.language === 'en-US' ? 'English localized summary.' : '中文本地化摘要。',
        claims: input.claims.map((_, index) =>
          input.language === 'en-US' ? `English fact ${index + 1}.` : `中文事实 ${index + 1}。`,
        ),
        openQuestions: input.openQuestions.map(() =>
          input.language === 'en-US' ? 'What remains open?' : '还有什么待确认？',
        ),
      };
    });

    await composer.run({ maxBriefs: 1 });
    let brief = new KeystoneBriefService(db).list({ limit: 1 })[0];
    expect(brief).toMatchObject({
      title: 'WhatsApp 关键简报',
      summary: '中文本地化摘要。',
      compositionVersion: 'auto-reflection-grounded-v2-zh-CN',
    });

    const timestamp = now();
    db.prepare(
      `INSERT INTO user_profile_items
        (id, item_type, item_key, item_value, evidence_refs, source_kind,
         confidence, user_confirmed, status, salience_score, mention_count,
         last_seen, valid_from, valid_to, created_at, updated_at, fingerprint)
       VALUES
        ('composer-language', 'preference', 'language_preference',
         'Reply and generate user-facing content in English.', '[]', 'explicit',
         1, 1, 'active', 1, 1, ?, NULL, NULL, ?, ?, 'composer-language-en')`,
    ).run(timestamp, timestamp, timestamp);

    const refreshed = await composer.run({ maxBriefs: 1 });
    brief = new KeystoneBriefService(db).list({ limit: 1 })[0];
    expect(refreshed.composed).toBe(1);
    expect(seenLanguages).toEqual(['zh-CN', 'en-US']);
    expect(brief).toMatchObject({
      title: 'WhatsApp Keystone Brief',
      summary: 'English localized summary.',
      compositionVersion: 'auto-reflection-grounded-v2-en-US',
    });
  });
});
