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
  const projectId = 'relationship-test-project-radar';
  const eventId = 'relationship-test-event-demo';

  beforeAll(async () => {
    db = getTestDb();
    db.prepare('DELETE FROM relationship_event_index WHERE entity_id = ?').run(personId);
    db.prepare('DELETE FROM relationship_context_cards WHERE entity_id = ?').run(personId);
    db.prepare('DELETE FROM relationship_review_items WHERE entity_id = ?').run(personId);
    db.prepare('DELETE FROM relationship_radar_people WHERE entity_id = ?').run(personId);
    db.prepare('DELETE FROM entity_properties WHERE entity_id = ?').run(personId);
    db.prepare('DELETE FROM calendar_events WHERE id = ? OR external_id = ?').run(
      eventId,
      eventId,
    );
    db.prepare('DELETE FROM relationships WHERE from_entity_id = ? OR to_entity_id = ?').run(
      personId,
      personId,
    );
    db.prepare('DELETE FROM messages_raw WHERE id LIKE ?').run('relationship-test-message-%');
    db.prepare('DELETE FROM entities WHERE id IN (?, ?)').run(personId, projectId);

    db.prepare(
      `INSERT INTO entities (
         id, type, name, aliases_json, description, importance, first_seen,
         last_seen, mention_count, tags_json, status, created_at
       ) VALUES (?, 'Person', 'Alice Radar', '["Alice"]', ?, 0.9, ?, ?, 12, '["product"]', 'active', ?)`,
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
    db.prepare('DELETE FROM calendar_events WHERE id = ? OR external_id = ?').run(
      eventId,
      eventId,
    );
    db.prepare('DELETE FROM relationships WHERE from_entity_id = ? OR to_entity_id = ?').run(
      personId,
      personId,
    );
    db.prepare('DELETE FROM messages_raw WHERE id LIKE ?').run('relationship-test-message-%');
    db.prepare('DELETE FROM entities WHERE id IN (?, ?)').run(personId, projectId);
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
    expect(body.retrievalHints.entityIds).toContain(personId);
    expect(body.evidenceRefs.length).toBeGreaterThan(0);
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
    expect(draftRes.json().draftText).toContain('确认关系雷达 demo');

    const graphRes = await app.inject({
      method: 'GET',
      url: '/api/v1/relationships/graph?limit=12',
    });
    expect(graphRes.statusCode).toBe(200);
    const graph = graphRes.json();
    expect(graph.nodes.some((node: { id: string }) => node.id === personId)).toBe(true);
    expect(graph.edges.length).toBeGreaterThan(0);
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
    const confirmRes = await app.inject({
      method: 'POST',
      url: `/api/v1/relationships/review-items/${encodeURIComponent(item.id)}/confirm`,
      payload: {
        editedValue: 'Alice Radar is the product partner for relationship radar validation.',
        userNote: 'Confirmed in API test',
      },
    });
    expect(confirmRes.statusCode).toBe(200);
    expect(confirmRes.json().status).toBe('confirmed');

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
