/**
 * Integration tests for entity API endpoints.
 *
 * Uses Fastify's inject() method — no real HTTP server is started.
 * Entities are inserted directly into the database to avoid LLM dependencies.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server.js';
import { getTestDb } from './setup.js';
import type BetterSqlite3 from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

describe('Entities API', () => {
  let app: FastifyInstance;
  let db: BetterSqlite3.Database;

  // Known entity IDs for testing
  const personId = uuidv4();
  const projectId = uuidv4();
  const techId = uuidv4();
  const nowEpoch = Math.floor(Date.now() / 1000);

  beforeAll(async () => {
    db = getTestDb();
    const result = await buildApp({ db });
    app = result.app;
    await app.ready();

    // Seed entities directly into the database
    const insertEntity = db.prepare(
      `INSERT INTO entities (id, type, name, aliases_json, description, importance,
         access_count, last_accessed, first_seen, last_seen, mention_count,
         tags_json, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
    );

    insertEntity.run(
      personId, 'Person', 'Alice Johnson', '["alice", "AJ"]',
      'A test person entity', 0.8,
      5, nowEpoch, nowEpoch - 86400, nowEpoch, 10,
      '["team-member"]', nowEpoch,
    );

    insertEntity.run(
      projectId, 'Project', 'Memory Service', '["mem-svc"]',
      'The personal AI memory service project', 0.9,
      12, nowEpoch, nowEpoch - 172800, nowEpoch, 25,
      '["ai", "backend"]', nowEpoch,
    );

    insertEntity.run(
      techId, 'Technology', 'SQLite', null,
      'An embedded relational database', 0.6,
      3, nowEpoch, nowEpoch - 86400, nowEpoch, 8,
      null, nowEpoch,
    );

    // Seed a relationship between person and project
    db.prepare(
      `INSERT INTO relationships (from_entity_id, to_entity_id, relation_type,
         strength, co_occurrence_count, evidence_message_ids_json, context,
         created_at)
       VALUES (?, ?, 'works_on', 0.9, 5, '[]', 'Alice works on Memory Service', ?)`,
    ).run(personId, projectId, nowEpoch);

    // Seed an entity property
    db.prepare(
      `INSERT INTO entity_properties (entity_id, property_key, property_value,
         value_type, source_authority, tx_start, confidence, status, action_type)
       VALUES (?, 'role', 'Backend Engineer', 'string', 'peer', ?, 0.85, 'active', 'set')`,
    ).run(personId, nowEpoch);
  });

  afterAll(async () => {
    await app.close();
  });

  // -------------------------------------------------------------------
  // GET /api/v1/entities — list all
  // -------------------------------------------------------------------
  it('GET /api/v1/entities → 200, returns items array', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/entities' });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body).toHaveProperty('items');
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBeGreaterThanOrEqual(3);
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('limit');
    expect(body).toHaveProperty('offset');
  });

  // -------------------------------------------------------------------
  // GET /api/v1/entities?type=Person — filtered by type
  // -------------------------------------------------------------------
  it('GET /api/v1/entities?type=Person → filtered results', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/entities?type=Person',
    });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body).toHaveProperty('items');
    expect(Array.isArray(body.items)).toBe(true);
    // All returned entities should be of type Person
    for (const entity of body.items) {
      expect(entity.type).toBe('Person');
    }
    // Should include our seeded person
    const alice = body.items.find((e: { id: string }) => e.id === personId);
    expect(alice).toBeTruthy();
    expect(alice.name).toBe('Alice Johnson');
  });

  // -------------------------------------------------------------------
  // GET /api/v1/entities?type=Technology — filtered by type
  // -------------------------------------------------------------------
  it('GET /api/v1/entities?type=Technology → filtered results', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/entities?type=Technology',
    });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    for (const entity of body.items) {
      expect(entity.type).toBe('Technology');
    }
  });

  // -------------------------------------------------------------------
  // GET /api/v1/entities/:id — existing entity
  // -------------------------------------------------------------------
  it('GET /api/v1/entities/:id → 200 with entity detail and properties', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/entities/${personId}`,
    });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.id).toBe(personId);
    expect(body.type).toBe('Person');
    expect(body.name).toBe('Alice Johnson');
    expect(body.description).toBe('A test person entity');
    expect(body.aliases).toEqual(['alice', 'AJ']);
    expect(body).toHaveProperty('properties');
    expect(Array.isArray(body.properties)).toBe(true);
    // Should contain the seeded property
    const roleProp = body.properties.find(
      (p: { propertyKey: string }) => p.propertyKey === 'role',
    );
    expect(roleProp).toBeTruthy();
    expect(roleProp.propertyValue).toBe('Backend Engineer');
  });

  // -------------------------------------------------------------------
  // GET /api/v1/entities/:id — nonexistent → 404
  // -------------------------------------------------------------------
  it('GET /api/v1/entities/nonexistent-id → 404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/entities/nonexistent-id-that-does-not-exist',
    });
    expect(res.statusCode).toBe(404);

    const body = res.json();
    expect(body).toHaveProperty('error');
  });

  // -------------------------------------------------------------------
  // GET /api/v1/entities/:id/timeline
  // -------------------------------------------------------------------
  it('GET /api/v1/entities/:id/timeline → 200, returns array', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/entities/${personId}/timeline`,
    });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body).toHaveProperty('entityId', personId);
    expect(body).toHaveProperty('timeline');
    expect(Array.isArray(body.timeline)).toBe(true);
    expect(body).toHaveProperty('total');
    expect(typeof body.total).toBe('number');
  });

  // -------------------------------------------------------------------
  // GET /api/v1/entities/:id/timeline — nonexistent → 404
  // -------------------------------------------------------------------
  it('GET /api/v1/entities/:id/timeline for nonexistent → 404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/entities/does-not-exist/timeline',
    });
    expect(res.statusCode).toBe(404);
  });

  // -------------------------------------------------------------------
  // GET /api/v1/entities/:id/relationships
  // -------------------------------------------------------------------
  it('GET /api/v1/entities/:id/relationships → 200, returns array', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/entities/${personId}/relationships`,
    });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body).toHaveProperty('entityId', personId);
    expect(body).toHaveProperty('relationships');
    expect(Array.isArray(body.relationships)).toBe(true);
    expect(body).toHaveProperty('depth');
    expect(body).toHaveProperty('total');

    // Should include the seeded works_on relationship
    expect(body.relationships.length).toBeGreaterThanOrEqual(1);
    const worksOn = body.relationships.find(
      (r: { relationType: string }) => r.relationType === 'works_on',
    );
    expect(worksOn).toBeTruthy();
  });

  // -------------------------------------------------------------------
  // GET /api/v1/entities/:id/relationships — nonexistent → 404
  // -------------------------------------------------------------------
  it('GET /api/v1/entities/:id/relationships for nonexistent → 404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/entities/does-not-exist/relationships',
    });
    expect(res.statusCode).toBe(404);
  });
});
