/**
 * Integration tests for watched projects CRUD API endpoints.
 *
 * Uses Fastify's inject() method — no real HTTP server is started.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server.js';
import { getTestDb } from './setup.js';
import type BetterSqlite3 from 'better-sqlite3';

describe('Watched Projects API', () => {
  let app: FastifyInstance;
  let db: BetterSqlite3.Database;

  // Will be set after creation
  let createdProjectId: string;

  beforeAll(async () => {
    db = getTestDb();
    const result = await buildApp({ db });
    app = result.app;
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // -------------------------------------------------------------------
  // POST /api/v1/projects/watched — create project
  // -------------------------------------------------------------------
  it('POST /api/v1/projects/watched → 201, creates project', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/projects/watched',
      payload: {
        name: 'Test Dashboard',
        description: 'A test project for integration tests',
        aliases: ['dashboard', 'td'],
        trackedProperties: ['status', 'owner'],
        priority: 8,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body).toHaveProperty('id');
    expect(body.id).toBe('test-dashboard'); // slugified from name
    expect(body.name).toBe('Test Dashboard');
    expect(body.description).toBe('A test project for integration tests');
    expect(body.aliases).toEqual(['dashboard', 'td']);
    expect(body.trackedProperties).toEqual(['status', 'owner']);
    expect(body.priority).toBe(8);
    expect(body.isActive).toBe(true);
    expect(body).toHaveProperty('createdAt');

    createdProjectId = body.id;
  });

  // -------------------------------------------------------------------
  // POST /api/v1/projects/watched — duplicate name → 409
  // -------------------------------------------------------------------
  it('POST /api/v1/projects/watched with duplicate name → 409', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/projects/watched',
      payload: {
        name: 'Test Dashboard', // same slug as above
      },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body).toHaveProperty('error');
  });

  // -------------------------------------------------------------------
  // POST /api/v1/projects/watched — missing name → 400
  // -------------------------------------------------------------------
  it('POST /api/v1/projects/watched with missing name → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/projects/watched',
      payload: {
        description: 'No name provided',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  // -------------------------------------------------------------------
  // GET /api/v1/projects/watched — list all
  // -------------------------------------------------------------------
  it('GET /api/v1/projects/watched → 200, returns array with created project', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/projects/watched',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);

    // Should include the project we created
    const found = body.find((p: { id: string }) => p.id === createdProjectId);
    expect(found).toBeTruthy();
    expect(found.name).toBe('Test Dashboard');
  });

  // -------------------------------------------------------------------
  // GET /api/v1/projects/watched/:id — existing
  // -------------------------------------------------------------------
  it('GET /api/v1/projects/watched/:id → 200', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/watched/${createdProjectId}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(createdProjectId);
    expect(body.name).toBe('Test Dashboard');
    expect(body.isActive).toBe(true);
  });

  // -------------------------------------------------------------------
  // GET /api/v1/projects/watched/:id — nonexistent → 404
  // -------------------------------------------------------------------
  it('GET /api/v1/projects/watched/:id for nonexistent → 404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/projects/watched/does-not-exist',
    });

    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body).toHaveProperty('error');
  });

  // -------------------------------------------------------------------
  // PUT /api/v1/projects/watched/:id — update project
  // -------------------------------------------------------------------
  it('PUT /api/v1/projects/watched/:id → 200, updates project', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/projects/watched/${createdProjectId}`,
      payload: {
        description: 'Updated description for integration test',
        priority: 10,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(createdProjectId);
    expect(body.description).toBe('Updated description for integration test');
    expect(body.priority).toBe(10);
    // Name should remain unchanged
    expect(body.name).toBe('Test Dashboard');
    expect(body).toHaveProperty('updatedAt');
    expect(body.updatedAt).toBeTruthy();
  });

  // -------------------------------------------------------------------
  // PUT /api/v1/projects/watched/:id — nonexistent → 404
  // -------------------------------------------------------------------
  it('PUT /api/v1/projects/watched/:id for nonexistent → 404', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/projects/watched/does-not-exist',
      payload: { description: 'Should fail' },
    });

    expect(res.statusCode).toBe(404);
  });

  // -------------------------------------------------------------------
  // DELETE /api/v1/projects/watched/:id — soft delete
  // -------------------------------------------------------------------
  it('DELETE /api/v1/projects/watched/:id → 200, soft deletes', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/projects/watched/${createdProjectId}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('id', createdProjectId);
    expect(body).toHaveProperty('deleted', true);
  });

  // -------------------------------------------------------------------
  // GET /api/v1/projects/watched (after soft delete) — should exclude deleted
  // -------------------------------------------------------------------
  it('GET /api/v1/projects/watched after delete → should not include deleted project', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/projects/watched',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);

    // Default listing is active_only=true, so the soft-deleted project should not appear
    const found = body.find((p: { id: string }) => p.id === createdProjectId);
    expect(found).toBeUndefined();
  });

  // -------------------------------------------------------------------
  // GET /api/v1/projects/watched?active_only=false — includes soft-deleted
  // -------------------------------------------------------------------
  it('GET /api/v1/projects/watched?active_only=false → includes soft-deleted project', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/projects/watched?active_only=false',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const found = body.find((p: { id: string }) => p.id === createdProjectId);
    expect(found).toBeTruthy();
    expect(found.isActive).toBe(false);
  });

  // -------------------------------------------------------------------
  // DELETE /api/v1/projects/watched/:id — nonexistent → 404
  // -------------------------------------------------------------------
  it('DELETE /api/v1/projects/watched/:id for nonexistent → 404', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/projects/watched/does-not-exist',
    });

    expect(res.statusCode).toBe(404);
  });
});
