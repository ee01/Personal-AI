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

  // POST /projects/watched/sync — authoritative per-team focus snapshot from Roadmap
  app.post<{
    Body: {
      teamId: string;
      teamName?: string;
      items?: Array<Record<string, unknown>>;
      syncedAt?: number;
    };
  }>('/projects/watched/sync', async (request, reply) => {
    const { db } = request.userContext;
    const body = request.body || { teamId: '' };
    if (!body.teamId) {
      return reply.status(400).send({ error: 'teamId is required' });
    }

    const {
      syncFocusProjectsForTeam,
    } = await import('../core/FocusProjectSyncService.js');

    const result = syncFocusProjectsForTeam(db, {
      teamId: String(body.teamId),
      teamName: body.teamName ? String(body.teamName) : undefined,
      syncedAt: Number(body.syncedAt) || Date.now(),
      items: Array.isArray(body.items)
        ? body.items.map((item) => ({
            key: String(item.key || ''),
            type: item.type ? String(item.type) : undefined,
            title: String(item.title || item.key || ''),
            alias: item.alias ? String(item.alias) : null,
            displayName: item.displayName ? String(item.displayName) : undefined,
            isDraft: item.isDraft === true,
            jiraKey: item.jiraKey ? String(item.jiraKey) : null,
            quarter: item.quarter ? String(item.quarter) : null,
            targetStart: item.targetStart ? String(item.targetStart) : null,
            targetEnd: item.targetEnd ? String(item.targetEnd) : null,
            start: item.start ? String(item.start) : null,
            days: typeof item.days === 'number' ? item.days : null,
            keywords: Array.isArray(item.keywords)
              ? item.keywords.map(String)
              : undefined,
            priorityHints:
              item.priorityHints && typeof item.priorityHints === 'object'
                ? (item.priorityHints as {
                    hasAlias?: boolean;
                    subActivity?: boolean;
                    intersectsCurrentMonth?: boolean;
                  })
                : undefined,
          }))
        : [],
    });

    return reply.status(200).send(result);
  });

  // POST /projects/watched/archive-team — archive all focus projects for a team
  app.post<{ Body: { teamId: string } }>(
    '/projects/watched/archive-team',
    async (request, reply) => {
      const { db } = request.userContext;
      const teamId = String(request.body?.teamId || '').trim();
      if (!teamId) {
        return reply.status(400).send({ error: 'teamId is required' });
      }
      const { archiveTeamFocusProjects } = await import(
        '../core/FocusProjectSyncService.js'
      );
      const archived = archiveTeamFocusProjects(db, teamId);
      return reply.status(200).send({ teamId, archived });
    },
  );

  // GET /projects/focus — list active focus/candidate projects for injection
  app.get('/projects/focus', async (request, reply) => {
    const { db } = request.userContext;
    const { listFocusProjects } = await import(
      '../core/FocusProjectSyncService.js'
    );
    const {
      buildFocusRowContext,
      buildFocusParagraphContext,
      buildFocusSeedContext,
    } = await import('../core/FocusProjectContextBuilder.js');
    const projects = listFocusProjects(db);
    return reply.status(200).send({
      projects,
      contexts: {
        row: buildFocusRowContext(projects),
        paragraph: buildFocusParagraphContext(projects),
        seeds: buildFocusSeedContext(projects),
      },
    });
  });

  // GET /projects/memory-candidates — personal-layer nominations not currently focused
  app.get('/projects/memory-candidates', async (request, reply) => {
    const { db } = request.userContext;
    const { listFocusProjects } = await import(
      '../core/FocusProjectSyncService.js'
    );
    const focus = listFocusProjects(db);
    const focusedNames = new Set(
      focus.flatMap((p) =>
        [p.name, p.displayName, ...(p.aliases || []), p.externalRef?.jiraKey]
          .filter(Boolean)
          .map((v) => String(v).toLowerCase()),
      ),
    );

    const rows = db
      .prepare(
        `SELECT id, name, type, description, mention_count, last_seen
         FROM entities
         WHERE type IN ('Project', 'Topic')
           AND status = 'active'
         ORDER BY mention_count DESC, last_seen DESC
         LIMIT 30`,
      )
      .all() as Array<{
      id: string;
      name: string;
      type: string;
      description: string | null;
      mention_count: number;
      last_seen: number | null;
    }>;

    const candidates = rows
      .filter((row) => !focusedNames.has(row.name.toLowerCase()))
      .slice(0, 8)
      .map((row) => ({
        id: row.id,
        title: row.name,
        type: row.type,
        description: row.description,
        mentionCount: row.mention_count,
        lastSeen: row.last_seen,
        source: 'memory',
      }));

    return reply.status(200).send({ candidates });
  });

  // Drift receipts for personal-layer roadmap overlays
  app.get<{ Querystring: { projectId?: string } }>(
    '/projects/drift-receipts',
    async (request, reply) => {
      const { db } = request.userContext;
      const { ProjectTimelineExtractor } = await import(
        '../core/ProjectTimelineExtractor.js'
      );
      const extractor = new ProjectTimelineExtractor(db);
      return reply.status(200).send({
        items: extractor.listOpenReceipts(request.query.projectId),
      });
    },
  );

  app.post<{
    Body: {
      id: string;
      status?: 'accepted' | 'ignored' | 'converged';
      barTargetEnd?: string;
      projectId?: string;
    };
  }>('/projects/drift-receipts/resolve', async (request, reply) => {
    const { db } = request.userContext;
    const { ProjectTimelineExtractor } = await import(
      '../core/ProjectTimelineExtractor.js'
    );
    const extractor = new ProjectTimelineExtractor(db);
    if (request.body?.barTargetEnd && request.body.projectId) {
      const converged = extractor.convergeIfMatches({
        projectId: request.body.projectId,
        barTargetEnd: request.body.barTargetEnd,
      });
      return reply.status(200).send({ converged });
    }
    if (!request.body?.id) {
      return reply.status(400).send({ error: 'id is required' });
    }
    extractor.resolveReceipt(request.body.id, request.body.status || 'ignored');
    return reply.status(200).send({ ok: true });
  });
}
