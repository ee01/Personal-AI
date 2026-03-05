/**
 * Watched Projects CRUD routes.
 *
 * GET    /projects/watched       - List all watched projects
 * POST   /projects/watched       - Create a new watched project
 * GET    /projects/watched/:id   - Get single watched project
 * PUT    /projects/watched/:id   - Update watched project (partial)
 * DELETE /projects/watched/:id   - Soft delete (set is_active=0)
 */

import type { FastifyInstance } from 'fastify';

import type { WatchedProject } from '../types/index.js';
import { now } from '../utils/time.js';

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface WatchedProjectRow {
  id: string;
  entity_id: string | null;
  name: string;
  description: string | null;
  aliases_json: string | null;
  auto_capture_rules_json: string | null;
  tracked_properties_json: string | null;
  is_active: number;
  priority: number;
  created_at: number;
  updated_at: number | null;
}

interface CreateProjectBody {
  name: string;
  description?: string;
  aliases?: string[];
  autoCaptureRules?: object;
  trackedProperties?: string[];
  priority?: number;
}

interface UpdateProjectBody {
  name?: string;
  description?: string;
  aliases?: string[];
  autoCaptureRules?: object;
  trackedProperties?: string[];
  priority?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function rowToProject(row: WatchedProjectRow): WatchedProject {
  return {
    id: row.id,
    entityId: row.entity_id ?? undefined,
    name: row.name,
    description: row.description ?? undefined,
    aliases: row.aliases_json ? safeJsonParse<string[]>(row.aliases_json) : undefined,
    autoCaptureRules: row.auto_capture_rules_json
      ? safeJsonParse(row.auto_capture_rules_json)
      : undefined,
    trackedProperties: row.tracked_properties_json
      ? safeJsonParse<string[]>(row.tracked_properties_json)
      : undefined,
    isActive: row.is_active === 1,
    priority: row.priority,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
  };
}

function safeJsonParse<T>(json: string): T | undefined {
  try {
    return JSON.parse(json) as T;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createProjectBodySchema = {
  type: 'object' as const,
  required: ['name'],
  properties: {
    name: { type: 'string' as const, minLength: 1 },
    description: { type: 'string' as const },
    aliases: { type: 'array' as const, items: { type: 'string' as const } },
    autoCaptureRules: { type: 'object' as const, additionalProperties: true },
    trackedProperties: { type: 'array' as const, items: { type: 'string' as const } },
    priority: { type: 'number' as const, minimum: 0 },
  },
  additionalProperties: false,
};

const updateProjectBodySchema = {
  type: 'object' as const,
  properties: {
    name: { type: 'string' as const, minLength: 1 },
    description: { type: 'string' as const },
    aliases: { type: 'array' as const, items: { type: 'string' as const } },
    autoCaptureRules: { type: 'object' as const, additionalProperties: true },
    trackedProperties: { type: 'array' as const, items: { type: 'string' as const } },
    priority: { type: 'number' as const, minimum: 0 },
  },
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function projectRoutes(
  app: FastifyInstance,
): Promise<void> {
  // GET /projects/watched — List all watched projects
  app.get<{ Querystring: { active_only?: string } }>(
    '/projects/watched',
    async (request, reply) => {
      const { db } = request.userContext;
      const activeOnly = request.query.active_only !== 'false'; // default true

      const sql = activeOnly
        ? 'SELECT * FROM watched_projects WHERE is_active = 1 ORDER BY priority DESC, created_at DESC'
        : 'SELECT * FROM watched_projects ORDER BY priority DESC, created_at DESC';

      const rows = db.prepare(sql).all() as WatchedProjectRow[];
      const projects = rows.map(rowToProject);

      return reply.status(200).send(projects);
    },
  );

  // POST /projects/watched — Create a new watched project
  app.post<{ Body: CreateProjectBody }>(
    '/projects/watched',
    { schema: { body: createProjectBodySchema } },
    async (request, reply) => {
      const { db } = request.userContext;
      const { name, description, aliases, autoCaptureRules, trackedProperties, priority } =
        request.body;

      const id = slugify(name);
      const currentTime = now();

      // Check for duplicate id
      const existing = db
        .prepare('SELECT id FROM watched_projects WHERE id = ?')
        .get(id) as { id: string } | undefined;

      if (existing) {
        return reply.status(409).send({ error: `Project with id "${id}" already exists` });
      }

      // Create the corresponding entity in the entities table
      const entityId = `project-${id}`;
      db.prepare(
        `INSERT OR IGNORE INTO entities (id, type, name, aliases_json, description, importance, access_count, mention_count, status, created_at)
         VALUES (?, 'Project', ?, ?, ?, 5, 0, 0, 'active', ?)`,
      ).run(
        entityId,
        name,
        aliases ? JSON.stringify(aliases) : null,
        description ?? null,
        currentTime,
      );

      // Create the watched project
      db.prepare(
        `INSERT INTO watched_projects (id, entity_id, name, description, aliases_json, auto_capture_rules_json, tracked_properties_json, is_active, priority, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      ).run(
        id,
        entityId,
        name,
        description ?? null,
        aliases ? JSON.stringify(aliases) : null,
        autoCaptureRules ? JSON.stringify(autoCaptureRules) : null,
        trackedProperties ? JSON.stringify(trackedProperties) : null,
        priority ?? 0,
        currentTime,
      );

      const row = db
        .prepare('SELECT * FROM watched_projects WHERE id = ?')
        .get(id) as WatchedProjectRow;

      return reply.status(201).send(rowToProject(row));
    },
  );

  // GET /projects/watched/:id — Get single watched project
  app.get<{ Params: { id: string } }>(
    '/projects/watched/:id',
    async (request, reply) => {
      const { db } = request.userContext;
      const { id } = request.params;

      const row = db
        .prepare('SELECT * FROM watched_projects WHERE id = ?')
        .get(id) as WatchedProjectRow | undefined;

      if (!row) {
        return reply.status(404).send({ error: `Project "${id}" not found` });
      }

      return reply.status(200).send(rowToProject(row));
    },
  );

  // PUT /projects/watched/:id — Update watched project (partial)
  app.put<{ Params: { id: string }; Body: UpdateProjectBody }>(
    '/projects/watched/:id',
    { schema: { body: updateProjectBodySchema } },
    async (request, reply) => {
      const { db } = request.userContext;
      const { id } = request.params;
      const body = request.body;

      const existing = db
        .prepare('SELECT * FROM watched_projects WHERE id = ?')
        .get(id) as WatchedProjectRow | undefined;

      if (!existing) {
        return reply.status(404).send({ error: `Project "${id}" not found` });
      }

      const currentTime = now();
      const updates: string[] = [];
      const params: unknown[] = [];

      if (body.name !== undefined) {
        updates.push('name = ?');
        params.push(body.name);
      }
      if (body.description !== undefined) {
        updates.push('description = ?');
        params.push(body.description);
      }
      if (body.aliases !== undefined) {
        updates.push('aliases_json = ?');
        params.push(JSON.stringify(body.aliases));
      }
      if (body.autoCaptureRules !== undefined) {
        updates.push('auto_capture_rules_json = ?');
        params.push(JSON.stringify(body.autoCaptureRules));
      }
      if (body.trackedProperties !== undefined) {
        updates.push('tracked_properties_json = ?');
        params.push(JSON.stringify(body.trackedProperties));
      }
      if (body.priority !== undefined) {
        updates.push('priority = ?');
        params.push(body.priority);
      }

      if (updates.length === 0) {
        return reply.status(200).send(rowToProject(existing));
      }

      updates.push('updated_at = ?');
      params.push(currentTime);
      params.push(id);

      db.prepare(`UPDATE watched_projects SET ${updates.join(', ')} WHERE id = ?`).run(...params);

      const row = db
        .prepare('SELECT * FROM watched_projects WHERE id = ?')
        .get(id) as WatchedProjectRow;

      return reply.status(200).send(rowToProject(row));
    },
  );

  // DELETE /projects/watched/:id — Soft delete (set is_active=0)
  app.delete<{ Params: { id: string } }>(
    '/projects/watched/:id',
    async (request, reply) => {
      const { db } = request.userContext;
      const { id } = request.params;

      const existing = db
        .prepare('SELECT id FROM watched_projects WHERE id = ?')
        .get(id) as { id: string } | undefined;

      if (!existing) {
        return reply.status(404).send({ error: `Project "${id}" not found` });
      }

      const currentTime = now();
      db.prepare('UPDATE watched_projects SET is_active = 0, updated_at = ? WHERE id = ?').run(
        currentTime,
        id,
      );

      return reply.status(200).send({ id, deleted: true });
    },
  );
}
