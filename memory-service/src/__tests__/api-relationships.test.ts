import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type BetterSqlite3 from 'better-sqlite3';

import { buildApp } from '../server.js';
import { getTestDb } from './setup.js';

describe('Relationships API', () => {
  let app: FastifyInstance;
  let db: BetterSqlite3.Database;

  const nowEpoch = Math.floor(Date.now() / 1000);
  const personId = 'relationship-test-person-alice';
  const storedPersonId = 'relationship-test-person-stored-freshness';
  const projectId = 'relationship-test-project-radar';
  const eventId = 'relationship-test-event-demo';

  beforeAll(async () => {
    db = getTestDb();
    db.prepare('DELETE FROM relationship_event_index WHERE entity_id = ?').run(personId);
    db.prepare('DELETE FROM relationship_context_cards WHERE entity_id = ?').run(personId);
    db.prepare('DELETE FROM relationship_review_items WHERE entity_id = ?').run(personId);
    db.prepare('DELETE FROM relationship_radar_people WHERE entity_id = ?').run(personId);
    db.prepare('DELETE FROM entity_properties WHERE entity_id = ?').run(personId);
    db.prepare('DELETE FROM relationship_event_index WHERE entity_id = ?').run(storedPersonId);
    db.prepare('DELETE FROM relationship_context_cards WHERE entity_id = ?').run(storedPersonId);
    db.prepare('DELETE FROM relationship_review_items WHERE entity_id = ?').run(storedPersonId);
    db.prepare('DELETE FROM relationship_radar_people WHERE entity_id = ?').run(storedPersonId);
    db.prepare('DELETE FROM entity_properties WHERE entity_id = ?').run(storedPersonId);
    db.prepare('DELETE FROM calendar_events WHERE id = ? OR external_id = ?').run(
      eventId,
      eventId,
    );
    db.prepare('DELETE FROM relationships WHERE from_entity_id = ? OR to_entity_id = ?').run(
      personId,
      personId,
    );
    db.prepare('DELETE FROM messages_raw WHERE id LIKE ?').run('relationship-test-message-%');
    db.prepare('DELETE FROM messages_raw WHERE id LIKE ?').run('relationship-test-stored-message-%');
    db.prepare('DELETE FROM entities WHERE id IN (?, ?, ?)').run(personId, storedPersonId, projectId);

    db.prepare(
      `INSERT INTO entities (
         id, type, name, aliases_json, description, importance, first_seen,
         last_seen, mention_count, tags_json, status, created_at
       ) VALUES (?, 'Person', 'Alice Radar', '["Alice","alice@example.com"]', ?, 0.9, ?, ?, 12, '["product"]', 'active', ?)`,
    ).run(
      personId,
      'Product partner for relationship radar testing',
      nowEpoch - 20 * 86400,
      nowEpoch - 3600,
      nowEpoch - 20 * 86400,
    );

    db.prepare(
      `INSERT INTO entities (
         id, type, name, aliases_json, description, importance, first_seen,
         last_seen, mention_count, tags_json, status, created_at
       ) VALUES (?, 'Person', 'Stored Radar', '["Stored"]', ?, 0.78, ?, ?, 7, '["ops"]', 'active', ?)`,
    ).run(
      storedPersonId,
      'Stored context card freshness fixture',
      nowEpoch - 12 * 86400,
      nowEpoch - 3 * 86400,
      nowEpoch - 12 * 86400,
    );

    db.prepare(
      `INSERT INTO entities (
         id, type, name, aliases_json, description, importance, first_seen,
         last_seen, mention_count, tags_json, status, created_at
       ) VALUES (?, 'Project', 'Relationship Radar', '[]', ?, 0.8, ?, ?, 8, '["memory"]', 'active', ?)`,
    ).run(
      projectId,
      'Relationship radar project',
      nowEpoch - 20 * 86400,
      nowEpoch - 3600,
      nowEpoch - 20 * 86400,
    );

    db.prepare(
      `INSERT INTO relationships (
         from_entity_id, to_entity_id, relation_type, strength,
         co_occurrence_count, evidence_message_ids_json, context, created_at
       ) VALUES (?, ?, 'works_on', 0.88, 6, '[]', 'Alice collaborates on Relationship Radar', ?)`,
    ).run(personId, projectId, nowEpoch - 86400);

    const insertMessage = db.prepare(
      `INSERT INTO messages_raw (
         id, content, summary, source_type, sender, group_id, group_name,
         timestamp, entities_json, importance, created_at, scope
       ) VALUES (?, ?, ?, 'glip', ?, 'team-radar', 'Radar Team', ?, ?, 0.8, ?, 'work')`,
    );

    for (let i = 0; i < 8; i += 1) {
      const ts = nowEpoch - i * 86400;
      insertMessage.run(
        `relationship-test-message-${i}`,
        i === 0
          ? 'Alice Radar 需要 follow up the relationship radar review workflow before next demo.'
          : `Alice Radar discussed relationship radar milestone ${i}.`,
        `Alice Radar update ${i}`,
        i % 2 === 0 ? 'Alice Radar' : 'Esone',
        ts,
        JSON.stringify([{ type: 'Person', id: personId, name: 'Alice Radar' }]),
        ts,
      );
    }

    for (let i = 0; i < 5; i += 1) {
      const ts = nowEpoch - (i + 2) * 86400;
      insertMessage.run(
        `relationship-test-stored-message-${i}`,
        i === 0
          ? 'Stored Radar needs follow up on context card freshness before the next review.'
          : `Stored Radar discussed relationship context card fixture ${i}.`,
        `Stored Radar update ${i}`,
        i % 2 === 0 ? 'Stored Radar' : 'Esone',
        ts,
        JSON.stringify([{ type: 'Person', id: storedPersonId, name: 'Stored Radar' }]),
        ts,
      );
    }

    insertMessage.run(
      'relationship-test-message-sensitive',
      'Alice Radar needs follow up via alice.private@example.com before the next demo.',
      'Alice Radar private email follow-up',
      'Alice Radar',
      nowEpoch - 30,
      JSON.stringify([{ type: 'Person', id: personId, name: 'Alice Radar' }]),
      nowEpoch - 30,
    );

    const insertProperty = db.prepare(
      `INSERT INTO entity_properties (
         entity_id, property_key, property_value, value_type, source_author,
         source_authority, source_context, tx_start, confidence, is_final,
         status, action_type
       ) VALUES (?, ?, ?, 'string', 'relationship-test', 'team_lead', ?, ?, ?, ?, 'active', 'set')`,
    );
    insertProperty.run(
      personId,
      'collaboration_style',
      'Prefers owner updates before demos.',
      'Public work context',
      nowEpoch - 1800,
      0.92,
      1,
    );
    insertProperty.run(
      personId,
      'private_email',
      'alice.private@example.com',
      'Private contact detail',
      nowEpoch - 1200,
      0.96,
      1,
    );

    db.prepare(
      `INSERT INTO calendar_events (
         id, source_system, external_id, title, description_preview, start_at,
         end_at, organizer_json, attendees_json, location, join_url, source_url,
         cancelled, content_hash, metadata_json, last_modified_at, synced_at,
         created_at, updated_at
       ) VALUES (?, 'outlook', ?, 'Relationship Radar demo sync',
         'Discuss relationship radar next steps', ?, ?, NULL, ?, NULL, NULL,
         NULL, 0, ?, '{}', ?, ?, ?, ?)`,
    ).run(
      eventId,
      eventId,
      nowEpoch + 3600,
      nowEpoch + 7200,
      JSON.stringify([{ name: 'Alice Radar', email: 'alice@example.com' }]),
      'relationship-test-event-hash',
      nowEpoch,
      nowEpoch,
      nowEpoch,
      nowEpoch,
    );

    const result = await buildApp({ db });
    app = result.app;
    await app.ready();
  });

  afterAll(async () => {
    db.prepare('DELETE FROM relationship_event_index WHERE entity_id = ?').run(personId);
    db.prepare('DELETE FROM relationship_context_cards WHERE entity_id = ?').run(personId);
    db.prepare('DELETE FROM relationship_review_items WHERE entity_id = ?').run(personId);
    db.prepare('DELETE FROM relationship_radar_people WHERE entity_id = ?').run(personId);
    db.prepare('DELETE FROM entity_properties WHERE entity_id = ?').run(personId);
    db.prepare('DELETE FROM relationship_event_index WHERE entity_id = ?').run(storedPersonId);
    db.prepare('DELETE FROM relationship_context_cards WHERE entity_id = ?').run(storedPersonId);
    db.prepare('DELETE FROM relationship_review_items WHERE entity_id = ?').run(storedPersonId);
    db.prepare('DELETE FROM relationship_radar_people WHERE entity_id = ?').run(storedPersonId);
    db.prepare('DELETE FROM entity_properties WHERE entity_id = ?').run(storedPersonId);
    db.prepare('DELETE FROM calendar_events WHERE id = ? OR external_id = ?').run(
      eventId,
      eventId,
    );
    db.prepare('DELETE FROM relationships WHERE from_entity_id = ? OR to_entity_id = ?').run(
      personId,
      personId,
    );
    db.prepare('DELETE FROM messages_raw WHERE id LIKE ?').run('relationship-test-message-%');
    db.prepare('DELETE FROM messages_raw WHERE id LIKE ?').run('relationship-test-stored-message-%');
    db.prepare('DELETE FROM entities WHERE id IN (?, ?, ?)').run(personId, storedPersonId, projectId);
    await app.close();
  });

  it('lists high-frequency relationship people with threshold metadata', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/relationships/people?limit=10',
    });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.threshold.strategy).toBe('hybrid_threshold_top_n');
    const alice = body.items.find((item: { id: string }) => item.id === personId);
    expect(alice).toBeTruthy();
    expect(alice.interactionCount).toBeGreaterThanOrEqual(8);
    expect(alice.score).toBeGreaterThan(0.45);
  });

  it('searches relationship people by aliases and email aliases', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/relationships/people?limit=10&search=${encodeURIComponent('alice@example.com')}`,
    });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    const alice = body.items.find((item: { id: string }) => item.id === personId);
    expect(alice).toBeTruthy();
    expect(body.totalCandidates).toBeGreaterThanOrEqual(1);
  });

  it('builds a context card for a person', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/relationships/context-card',
      payload: {
        personId,
        surface: 'memory_exploring',
        tokenBudget: 600,
      },
    });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.person.id).toBe(personId);
    expect(body.contextMd).toContain('Alice Radar');
    expect(JSON.stringify(body)).not.toContain('alice.private@example.com');
    expect(body.person.aliases).not.toContain('alice@example.com');
    expect(body.privacySummary.sensitiveIncluded).toBe(false);
    expect(body.privacySummary.redactedAliases).toBeGreaterThan(0);
    expect(body.privacySummary.redactedFacts).toBeGreaterThan(0);
    expect(body.privacySummary.redactedEvidenceRefs).toBeGreaterThan(0);
    expect(body.privacySummary.redactedOpenLoops).toBeGreaterThan(0);
    expect(body.privacySummary.redactionNote).toContain('默认未纳入');
    expect(body.contextReceipt.title).toBe('上下文卡回执');
    expect(body.contextReceipt.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: '生成来源',
          value: expect.stringContaining('索引即时计算'),
          tone: 'warn',
        }),
        expect.objectContaining({
          label: '隐私范围',
          value: expect.stringContaining('默认隐藏'),
          tone: 'ok',
        }),
      ]),
    );
    expect(body.contextReceipt.boundary).toContain('不会写入画像、发送消息或自动刷新其他场景');
    expect(body.retrievalHints.entityIds).toContain(personId);
    expect(body.evidenceRefs.length).toBeGreaterThan(0);
    expect(body.actionSuggestions.length).toBeGreaterThan(0);
    expect(
      body.actionSuggestions.some((item: { title: string }) =>
        item.title.includes('先闭环'),
      ),
    ).toBe(true);
    expect(body.contextMd).toContain('## 上下文卡回执');
    expect(body.contextMd).toContain('生成来源:');
    expect(body.contextMd).toContain('隐私范围: 默认隐藏');
    expect(body.contextMd).toContain('## 现在建议');
    expect(
      body.evidenceRefs.some((ref: { exploreLink?: string }) =>
        ref.exploreLink?.startsWith(
          '#/timeline?type=message&focus=relationship-test-message-',
        ),
      ),
    ).toBe(true);

    const sensitiveRes = await app.inject({
      method: 'POST',
      url: '/api/v1/relationships/context-card',
      payload: {
        personId,
        surface: 'memory_exploring',
        tokenBudget: 600,
        includeSensitive: true,
      },
    });
    expect(sensitiveRes.statusCode).toBe(200);
    const sensitiveBody = sensitiveRes.json();
    expect(sensitiveBody.privacySummary.sensitiveIncluded).toBe(true);
    expect(sensitiveBody.contextReceipt.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: '隐私范围',
          value: '已临时包含敏感上下文',
          tone: 'warn',
        }),
      ]),
    );
    expect(sensitiveBody.contextReceipt.boundary).toContain('已显式包含敏感上下文');
    expect(sensitiveBody.contextMd).toContain('隐私范围: 已临时包含敏感上下文');
    expect(sensitiveBody.person.aliases).toContain('alice@example.com');
    expect(JSON.stringify(sensitiveBody)).toContain('alice.private@example.com');
  });

  it('consolidates relationship radar projections in the background', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/relationships/consolidate',
      payload: { personIds: [personId], force: true },
    });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.consolidated).toBe(1);
    expect(body.personIds).toContain(personId);

    const storedCard = db
      .prepare(
        `SELECT data_quality, context_md
         FROM relationship_context_cards
         WHERE entity_id = ?
         LIMIT 1`,
      )
      .get(personId) as { data_quality: string; context_md: string } | undefined;
    expect(storedCard?.data_quality).toBe('generated');
    expect(storedCard?.context_md).toContain('Alice Radar');
    expect(storedCard?.context_md).toContain('## 现在建议');
  });

  it('rebuilds a stored context card after a relationship fact is confirmed', async () => {
    const storedCard = db
      .prepare(
        `SELECT generated_at
         FROM relationship_context_cards
         WHERE entity_id = ?
         LIMIT 1`,
      )
      .get(personId) as { generated_at: number } | undefined;
    expect(storedCard?.generated_at).toBeTruthy();

    db.prepare(
      `INSERT INTO entity_properties (
         entity_id, property_key, property_value, value_type, source_author,
         source_authority, source_context, tx_start, confidence, is_final,
         status, action_type
       ) VALUES (?, 'relationship_context', ?, 'string', 'user', 'self', ?, ?, 0.97, 1, 'active', 'confirm')`,
    ).run(
      personId,
      'Alice Radar owns the Relationship Radar review queue.',
      'Confirmed after stored context card generation',
      storedCard!.generated_at + 60,
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/relationships/context-card',
      payload: {
        personId,
        surface: 'memory_exploring_person_tab',
        tokenBudget: 900,
      },
    });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.dataQuality).toBe('confirmed');
    expect(body.person.dataQuality).toBe('confirmed');
    expect(body.projectionSource).toBe('user_confirmed');
    expect(body.contextReceipt.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: '生成来源',
          value: '人工确认画像 · 已确认',
          tone: 'ok',
        }),
      ]),
    );
    expect(body.knownFacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'relationship_context',
          value: 'Alice Radar owns the Relationship Radar review queue.',
          confirmed: true,
        }),
      ]),
    );
    expect(body.contextMd).toContain('relationship_context: Alice Radar owns the Relationship Radar review queue.');
  });

  it('marks a reused stored context card as stale after newer interaction', async () => {
    const consolidationRes = await app.inject({
      method: 'POST',
      url: '/api/v1/relationships/consolidate',
      payload: { personIds: [storedPersonId], force: true },
    });
    expect(consolidationRes.statusCode).toBe(200);

    const storedProjection = db
      .prepare(
        `SELECT last_consolidated_at
         FROM relationship_radar_people
         WHERE entity_id = ?
         LIMIT 1`,
      )
      .get(storedPersonId) as { last_consolidated_at: number } | undefined;
    expect(storedProjection?.last_consolidated_at).toBeTruthy();

    const newerInteractionAt = storedProjection!.last_consolidated_at + 60;
    db.prepare(
      `INSERT INTO messages_raw (
         id, content, summary, source_type, sender, group_id, group_name,
         timestamp, entities_json, importance, created_at, scope
       ) VALUES (?, ?, ?, 'glip', ?, 'team-radar', 'Radar Team', ?, ?, 0.8, ?, 'work')`,
    ).run(
      'relationship-test-stored-message-newer',
      'Stored Radar needs follow up on the newer interaction before sharing the context card.',
      'Stored Radar newer interaction',
      'Stored Radar',
      newerInteractionAt,
      JSON.stringify([{ type: 'Person', id: storedPersonId, name: 'Stored Radar' }]),
      newerInteractionAt,
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/relationships/context-card',
      payload: {
        personId: storedPersonId,
        surface: 'memory_exploring_person_tab',
        tokenBudget: 900,
      },
    });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.dataQuality).toBe('stale');
    expect(body.person.dataQuality).toBe('stale');
    expect(body.contextReceipt.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: '生成来源',
          value: '后台整理 · 有新互动待刷新',
          tone: 'warn',
        }),
      ]),
    );
    expect(body.contextReceipt.boundary).toContain('新互动待整理');
    expect(body.contextMd).toContain('后台整理 · 有新互动待刷新');
    expect(body.contextMd).toContain('外发前建议刷新并核对最新证据');
  });

  it('builds meeting people brief, assistant draft, and relationship graph', async () => {
    const briefRes = await app.inject({
      method: 'POST',
      url: '/api/v1/relationships/meeting-brief',
      payload: { eventId },
    });
    expect(briefRes.statusCode).toBe(200);
    const brief = briefRes.json();
    expect(brief.title).toContain('Relationship Radar demo');
    expect(brief.attendees[0].personId).toBe(personId);
    expect(brief.matrix[0].suggestedAsk).toBeTruthy();
    expect(brief.sourceReceipt.title).toBe('简报来源回执');
    expect(brief.sourceReceipt.rows.some((row: { value: string }) => row.value === '日历事件')).toBe(true);
    expect(brief.sourceReceipt.boundary).toContain('不含敏感上下文');

    const draftRes = await app.inject({
      method: 'POST',
      url: '/api/v1/relationships/assistant/draft',
      payload: {
        personId,
        scenario: 'follow_up_message',
        userGoal: '确认关系雷达 demo 的评审结论',
      },
    });
    expect(draftRes.statusCode).toBe(200);
    const draft = draftRes.json();
    expect(draft.draftText).toContain('确认关系雷达 demo');
    expect(draft.draftText).toContain('owner');
    expect(draft.draftReceipt.title).toBe('草稿生成回执');
    expect(draft.draftReceipt.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: '生成来源',
          value: '人工确认画像 · 已确认',
          tone: 'ok',
        }),
        expect.objectContaining({
          label: '草稿范围',
          value: expect.stringContaining('默认隐藏'),
          tone: 'ok',
        }),
        expect.objectContaining({
          label: '外部动作',
          value: '未发送、未写回、未建任务',
          tone: 'ok',
        }),
      ]),
    );
    expect(draft.draftReceipt.boundary).toContain('不会发送消息、写入人物画像');
    expect(draft.draftReceipt.boundary).toContain('没有进入草稿');
    expect(draft.contextPackage.cards[0].privacySummary.sensitiveIncluded).toBe(false);
    expect(draft.contextPackage.cards[0].surface).toBe('relationship_assistant_draft');
    expect(draft.safetyReview.status).toBe('review_first');
    expect(draft.safetyReview.evidenceCount).toBeGreaterThan(0);
    expect(draft.safetyReview.openLoopCount).toBeGreaterThan(0);
    expect(draft.safetyReview.pendingReviewCount).toBeGreaterThan(0);
    expect(draft.safetyReview.hiddenSensitiveCount).toBeGreaterThan(0);
    expect(draft.contextBasis.primarySuggestion.title).toBeTruthy();
    expect(draft.suggestedChecks.join(' ')).toContain('open loop');
    expect(draft.warnings.join(' ')).toContain('敏感');

    const invalidDraftRes = await app.inject({
      method: 'POST',
      url: '/api/v1/relationships/assistant/draft',
      payload: {
        personId,
        includeSensitive: true,
      },
    });
    expect(invalidDraftRes.statusCode).toBe(400);

    const graphRes = await app.inject({
      method: 'GET',
      url: '/api/v1/relationships/graph?limit=12',
    });
    expect(graphRes.statusCode).toBe(200);
    const graph = graphRes.json();
    expect(graph.nodes.some((node: { id: string }) => node.id === personId)).toBe(true);
    expect(graph.edges.length).toBeGreaterThan(0);
  });

  it('marks missing calendar event ids as manual fallback in meeting brief receipts', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/relationships/meeting-brief',
      payload: {
        eventId: 'relationship-test-event-missing',
        title: 'Fallback relationship prep',
        attendees: [{ email: 'alice@example.com' }],
      },
    });
    expect(res.statusCode).toBe(200);

    const brief = res.json();
    const inputSource = brief.sourceReceipt.rows.find(
      (row: { label: string }) => row.label === '输入来源',
    );
    expect(inputSource).toEqual(
      expect.objectContaining({
        value: '日历事件未找到，已改用手动输入',
        tone: 'warn',
      }),
    );
    expect(brief.title).toBe('Fallback relationship prep');
    expect(brief.attendees[0].personId).toBe(personId);
  });

  it('marks manual overrides on calendar meeting brief receipts', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/relationships/meeting-brief',
      payload: {
        eventId,
        title: 'Override relationship prep',
        attendees: [{ name: 'External Reviewer', email: 'external@example.com' }],
      },
    });
    expect(res.statusCode).toBe(200);

    const brief = res.json();
    const inputSource = brief.sourceReceipt.rows.find(
      (row: { label: string }) => row.label === '输入来源',
    );
    expect(inputSource).toEqual(
      expect.objectContaining({
        value: '日历事件 + 手动覆盖',
        tone: 'warn',
      }),
    );
    expect(brief.title).toBe('Override relationship prep');
    expect(brief.coverage.totalAttendees).toBe(1);
    expect(brief.attendees[0].displayName).toBe('External Reviewer');
  });

  it('explains meeting brief attendee match coverage and email-only gaps', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/relationships/meeting-brief',
      payload: {
        title: 'Email-only prep',
        attendees: [
          { email: 'alice@example.com' },
          { name: 'External Reviewer', email: 'external@example.com' },
        ],
      },
    });
    expect(res.statusCode).toBe(200);

    const brief = res.json();
    expect(brief.coverage.totalAttendees).toBe(2);
    expect(brief.coverage.matchedAttendees).toBe(1);
    expect(brief.coverage.unmatchedAttendees).toBe(1);
    expect(brief.coverage.identityCheckAttendees).toBe(0);
    expect(brief.coverage.attendeesWithEvidence).toBe(1);
    expect(brief.readiness.status).toBe('attention');
    expect(brief.readiness.summary).toContain('1 位参会人未匹配人物记忆');
    expect(brief.readiness.nextActions.join(' ')).toContain('External Reviewer');
    expect(brief.readiness.successCriteria.join(' ')).toContain('1/2');
    expect(brief.attendees[0].personId).toBe(personId);
    expect(brief.attendees[0].matchedBy).toBe('email');
    expect(brief.attendees[0].coverageState).toBe('ready');
    expect(brief.attendees[1].matchedBy).toBe('none');
    expect(brief.attendees[1].coverageState).toBe('missing');
    expect(brief.matrix[1].matchStatus).toBe('未匹配');
  });

  it('marks weak meeting brief attendee matches as identity checks instead of ready', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/relationships/meeting-brief',
      payload: {
        title: 'Weak alias prep',
        attendees: [{ email: 'alice@unknown.example' }],
      },
    });
    expect(res.statusCode).toBe(200);

    const brief = res.json();
    expect(brief.coverage.totalAttendees).toBe(1);
    expect(brief.coverage.matchedAttendees).toBe(1);
    expect(brief.coverage.identityCheckAttendees).toBe(1);
    expect(brief.coverage.evidenceRefs).toBe(0);
    expect(brief.coverage.attendeesWithEvidence).toBe(0);
    expect(brief.coverage.attendeesWithOpenLoops).toBe(0);
    expect(brief.coverage.coverageNote).toContain('弱匹配');
    expect(brief.coverage.coverageNote).toContain('已暂缓展开历史上下文');
    expect(brief.readiness.status).toBe('partial');
    expect(brief.readiness.summary).toContain('弱匹配');
    expect(brief.readiness.summary).toContain('历史上下文已暂缓展开');
    expect(brief.readiness.nextActions.join(' ')).toContain('先确认');
    expect(brief.readiness.nextActions.join(' ')).toContain('重新生成');
    expect(brief.readiness.successCriteria.join(' ')).toContain('人工确认');
    expect(brief.sourceReceipt.rows.map((row: { value: string }) => row.value).join(' ')).toContain('弱匹配已隐藏历史上下文');
    expect(brief.sourceReceipt.rows.map((row: { value: string }) => row.value).join(' ')).toContain('本次没有可引用证据');
    expect(brief.attendees[0].personId).toBe(personId);
    expect(brief.attendees[0].matchedBy).toBe('email_local_part');
    expect(brief.attendees[0].identityCheckRequired).toBe(true);
    expect(brief.attendees[0].identityCheckReason).toContain('先确认');
    expect(brief.attendees[0].contextSuppressedReason).toContain('暂缓展开历史证据');
    expect(brief.attendees[0].coverageState).toBe('thin');
    expect(brief.attendees[0].evidenceRefs).toHaveLength(0);
    expect(brief.attendees[0].openLoops).toHaveLength(0);
    expect(brief.attendees[0].summary).toContain('历史上下文暂不展开');
    expect(brief.attendees[0].suggestedQuestions[0]).toContain('先确认');
    expect(brief.matrix[0].openLoop).toContain('暂不展开');
    expect(brief.matrix[0].evidenceCount).toBe(0);
  });

  it('makes large meeting attendee truncation explicit', async () => {
    const overflowAttendees = Array.from({ length: 17 }, (_, index) => ({
      name: `Overflow Reviewer ${index + 1}`,
      email: `overflow-${index + 1}@example.com`,
    }));
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/relationships/meeting-brief',
      payload: {
        title: 'Large relationship review',
        attendees: [{ email: 'alice@example.com' }, ...overflowAttendees],
      },
    });
    expect(res.statusCode).toBe(200);

    const brief = res.json();
    expect(brief.coverage.totalAttendees).toBe(18);
    expect(brief.coverage.processedAttendees).toBe(16);
    expect(brief.coverage.omittedAttendees).toBe(2);
    expect(brief.coverage.matchedAttendees).toBe(1);
    expect(brief.coverage.unmatchedAttendees).toBe(15);
    expect(brief.attendees).toHaveLength(16);
    expect(brief.omittedAttendees).toHaveLength(2);
    expect(brief.omittedAttendees[0].displayName).toBe('Overflow Reviewer 16');
    expect(brief.omittedAttendees[0].reason).toContain('前 16 位分析上限');
    expect(brief.coverage.coverageNote).toContain('已分析前 16/18 位参会人');
    expect(brief.readiness.status).toBe('attention');
    expect(brief.readiness.nextActions.join(' ')).toContain('分批生成');
  });

  it('returns explicit readiness guidance when no attendees are provided', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/relationships/meeting-brief',
      payload: {
        title: 'No attendee prep',
        attendees: [],
      },
    });
    expect(res.statusCode).toBe(200);

    const brief = res.json();
    expect(brief.coverage.totalAttendees).toBe(0);
    expect(brief.readiness.status).toBe('empty');
    expect(brief.readiness.summary).toContain('缺少参会人');
    expect(brief.readiness.nextActions[0]).toContain('补充日历参会人');
    expect(brief.readiness.successCriteria.join(' ')).toContain('核心参会人');
  });

  it('returns timeline and open loop evidence', async () => {
    const timeline = await app.inject({
      method: 'GET',
      url: `/api/v1/relationships/people/${personId}/timeline?limit=5`,
    });
    expect(timeline.statusCode).toBe(200);
    expect(timeline.json().items.length).toBeGreaterThan(0);

    const openLoops = await app.inject({
      method: 'GET',
      url: `/api/v1/relationships/people/${personId}/open-loops?limit=5`,
    });
    expect(openLoops.statusCode).toBe(200);
    expect(openLoops.json().items[0].snippet).toContain('follow up');
  });

  it('creates review items and confirms them into entity properties', async () => {
    const reviewRes = await app.inject({
      method: 'GET',
      url: `/api/v1/relationships/review-items?status=pending&personId=${personId}`,
    });
    expect(reviewRes.statusCode).toBe(200);
    const reviewBody = reviewRes.json();
    expect(reviewBody.items.length).toBeGreaterThan(0);

    const item = reviewBody.items[0];
    const snoozeRes = await app.inject({
      method: 'POST',
      url: `/api/v1/relationships/review-items/${encodeURIComponent(item.id)}/snooze`,
      payload: {
        editedValue: 'Alice Radar should be reviewed again after the next sync.',
        userNote: 'Review after the next relationship sync',
      },
    });
    expect(snoozeRes.statusCode).toBe(200);
    const snoozedItem = snoozeRes.json();
    expect(snoozedItem.status).toBe('snoozed');
    expect(snoozedItem.actionReceipt.title).toContain('稍后复核');
    expect(snoozedItem.actionReceipt.outcome).toBe('queued_for_later');
    expect(snoozedItem.actionReceipt.availableAt).toBeGreaterThan(nowEpoch);
    expect(snoozedItem.actionReceipt.noteCaptured).toBe(true);
    expect(snoozedItem.actionReceipt.nextActions.join(' ')).toContain('不会写入人物画像');
    expect(snoozedItem.proposedValue).toContain('reviewed again');

    const peopleWhileSnoozedRes = await app.inject({
      method: 'GET',
      url: '/api/v1/relationships/people?limit=10',
    });
    expect(peopleWhileSnoozedRes.statusCode).toBe(200);
    const snoozedAlice = peopleWhileSnoozedRes
      .json()
      .items.find((candidate: { id: string }) => candidate.id === personId);
    expect(snoozedAlice?.reviewPendingCount).toBe(0);

    db.prepare(
      `UPDATE relationship_review_items
       SET snooze_until = ?, updated_at = ?
       WHERE id = ?`,
    ).run(nowEpoch - 60, nowEpoch - 60, item.id);

    const dueReviewRes = await app.inject({
      method: 'GET',
      url: `/api/v1/relationships/review-items?status=pending&personId=${personId}`,
    });
    expect(dueReviewRes.statusCode).toBe(200);
    const dueItem = dueReviewRes
      .json()
      .items.find((candidate: { id: string }) => candidate.id === item.id);
    expect(dueItem?.status).toBe('pending');
    expect(dueItem?.snoozeUntil).toBeUndefined();
    expect(dueItem?.proposedValue).toContain('reviewed again');

    const confirmRes = await app.inject({
      method: 'POST',
      url: `/api/v1/relationships/review-items/${encodeURIComponent(item.id)}/confirm`,
      payload: {
        editedValue: 'Alice Radar is the product partner for relationship radar validation.',
        userNote: 'Confirmed in API test',
      },
    });
    expect(confirmRes.statusCode).toBe(200);
    const confirmedItem = confirmRes.json();
    expect(confirmedItem.status).toBe('confirmed');
    expect(confirmedItem.actionReceipt.title).toContain('写入人物画像');
    expect(confirmedItem.actionReceipt.outcome).toBe('profile_updated');
    expect(confirmedItem.actionReceipt.nextActions.join(' ')).toContain('Context Card');
    expect(confirmedItem.actionReceipt.nextActions.join(' ')).toContain('编辑后的写入内容');
    expect(confirmedItem.actionReceipt.evidenceCount).toBeGreaterThan(0);

    const property = db
      .prepare(
        `SELECT property_value, is_final
         FROM entity_properties
         WHERE entity_id = ? AND property_key = 'relationship_context'
         ORDER BY id DESC
         LIMIT 1`,
      )
      .get(personId) as { property_value: string; is_final: number } | undefined;
    expect(property?.property_value).toContain('product partner');
    expect(property?.is_final).toBe(1);
  });
});
