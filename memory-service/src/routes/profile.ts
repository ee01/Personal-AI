/**
 * Profile CRUD API routes (Dual Persona: Human Model + Agent Model).
 *
 * GET    /profile/items              - List user profile items with filters
 * POST   /profile/items              - Add a profile item (explicit entry)
 * PUT    /profile/items/:id          - Update a profile item
 * DELETE /profile/items/:id          - Soft-delete (set status='retracted')
 * POST   /profile/items/:id/confirm  - User confirms an inferred item
 * GET    /profile/core               - Get USER_CORE.md content
 * GET    /profile/social             - List social edges
 * POST   /profile/social             - Add a social edge
 * GET    /profile/opinions           - List opinion items
 * POST   /profile/opinions/:id/confirm - Confirm or reject an opinion
 */

import type { FastifyInstance } from 'fastify';
import { v4 } from 'uuid';

import type { UserContext } from '../core/UserContextManager.js';
import { contentHash } from '../utils/hashing.js';
import { now } from '../utils/time.js';

// ---------------------------------------------------------------------------
// Row interfaces
// ---------------------------------------------------------------------------

interface ProfileItemRow {
  id: string;
  item_type: string;
  item_key: string;
  item_value: string;
  evidence_refs: string | null;
  source_kind: string;
  confidence: number;
  user_confirmed: number;
  status: string;
  salience_score: number;
  mention_count: number;
  last_seen: number;
  valid_from: number | null;
  valid_to: number | null;
  created_at: number;
  updated_at: number;
  fingerprint: string;
}

interface SocialEdgeRow {
  id: string;
  from_entity_id: string;
  to_entity_id: string;
  relation_type: string;
  strength: number;
  evidence_refs: string | null;
  confidence: number;
  user_confirmed: number;
  valid_from: number | null;
  valid_to: number | null;
  created_at: number;
  updated_at: number;
}

interface OpinionItemRow {
  id: string;
  target_entity_id: string;
  dimension: string;
  valence: number;
  intensity: number;
  rationale: string | null;
  evidence_refs: string | null;
  confidence: number;
  user_confirmed: number;
  status: string;
  valid_from: number | null;
  valid_to: number | null;
  created_at: number;
  updated_at: number;
}

interface CountRow {
  count: number;
}

// ---------------------------------------------------------------------------
// JSON helpers
// ---------------------------------------------------------------------------

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatProfileItem(row: ProfileItemRow) {
  return {
    id: row.id,
    itemType: row.item_type,
    itemKey: row.item_key,
    itemValue: row.item_value,
    evidenceRefs: safeJsonParse<unknown[]>(row.evidence_refs, []),
    sourceKind: row.source_kind,
    confidence: row.confidence,
    userConfirmed: !!row.user_confirmed,
    status: row.status,
    salienceScore: row.salience_score,
    mentionCount: row.mention_count,
    lastSeen: row.last_seen,
    validFrom: row.valid_from,
    validTo: row.valid_to,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    fingerprint: row.fingerprint,
  };
}

function formatSocialEdge(row: SocialEdgeRow) {
  return {
    id: row.id,
    fromEntityId: row.from_entity_id,
    toEntityId: row.to_entity_id,
    relationType: row.relation_type,
    strength: row.strength,
    evidenceRefs: safeJsonParse<unknown[]>(row.evidence_refs, []),
    confidence: row.confidence,
    userConfirmed: !!row.user_confirmed,
    validFrom: row.valid_from,
    validTo: row.valid_to,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function formatOpinionItem(row: OpinionItemRow) {
  return {
    id: row.id,
    targetEntityId: row.target_entity_id,
    dimension: row.dimension,
    valence: row.valence,
    intensity: row.intensity,
    rationale: row.rationale,
    evidenceRefs: safeJsonParse<unknown[]>(row.evidence_refs, []),
    confidence: row.confidence,
    userConfirmed: !!row.user_confirmed,
    status: row.status,
    validFrom: row.valid_from,
    validTo: row.valid_to,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createProfileItemBodySchema = {
  type: 'object' as const,
  required: ['itemType', 'itemKey', 'itemValue'],
  properties: {
    itemType: { type: 'string' as const, enum: ['fact', 'preference', 'habit', 'interest', 'constraint'] },
    itemKey: { type: 'string' as const, minLength: 1 },
    itemValue: { type: 'string' as const, minLength: 1 },
    evidenceRefs: { type: 'array' as const, items: { type: 'object' as const } },
    confidence: { type: 'number' as const, minimum: 0, maximum: 1 },
    validFrom: { type: 'number' as const },
    validTo: { type: 'number' as const },
  },
  additionalProperties: false,
};

const updateProfileItemBodySchema = {
  type: 'object' as const,
  properties: {
    itemValue: { type: 'string' as const, minLength: 1 },
    confidence: { type: 'number' as const, minimum: 0, maximum: 1 },
    salienceScore: { type: 'number' as const, minimum: 0, maximum: 1 },
    validFrom: { type: 'number' as const },
    validTo: { type: 'number' as const },
    status: {
      type: 'string' as const,
      enum: ['active', 'pending_confirm', 'superseded', 'retracted', 'archived'],
    },
  },
  additionalProperties: false,
};

const createSocialEdgeBodySchema = {
  type: 'object' as const,
  required: ['fromEntityId', 'toEntityId', 'relationType'],
  properties: {
    fromEntityId: { type: 'string' as const, minLength: 1 },
    toEntityId: { type: 'string' as const, minLength: 1 },
    relationType: { type: 'string' as const, enum: ['colleague', 'manager', 'report', 'friend', 'client', 'vendor'] },
    strength: { type: 'number' as const, minimum: 0, maximum: 1 },
    evidenceRefs: { type: 'array' as const, items: { type: 'object' as const } },
    confidence: { type: 'number' as const, minimum: 0, maximum: 1 },
    validFrom: { type: 'number' as const },
    validTo: { type: 'number' as const },
  },
  additionalProperties: false,
};

const confirmOpinionBodySchema = {
  type: 'object' as const,
  required: ['action'],
  properties: {
    action: { type: 'string' as const, enum: ['accept', 'reject'] },
  },
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// Body interfaces
// ---------------------------------------------------------------------------

interface CreateProfileItemBody {
  itemType: string;
  itemKey: string;
  itemValue: string;
  evidenceRefs?: unknown[];
  confidence?: number;
  validFrom?: number;
  validTo?: number;
}

interface UpdateProfileItemBody {
  itemValue?: string;
  confidence?: number;
  salienceScore?: number;
  validFrom?: number;
  validTo?: number;
  status?: string;
}

interface CreateSocialEdgeBody {
  fromEntityId: string;
  toEntityId: string;
  relationType: string;
  strength?: number;
  evidenceRefs?: unknown[];
  confidence?: number;
  validFrom?: number;
  validTo?: number;
}

interface ConfirmOpinionBody {
  action: 'accept' | 'reject';
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function profileRoutes(
  app: FastifyInstance,
): Promise<void> {
  async function refreshUserCoreSnapshot(userContext: UserContext): Promise<void> {
    try {
      const currentTime = now();
      const content = userContext.profileManager.renderUserCore(50);

      if (userContext.userDataManager?.isInitialized) {
        userContext.userDataManager.writeFile('USER_CORE.md', content);
        const { MarkdownManager } = await import('../core/MarkdownManager.js');
        const markdownManager = new MarkdownManager(
          userContext.db,
          userContext.userDataManager.rootDir,
        );
        await markdownManager.reindexFile('USER_CORE.md');
      }

      userContext.db
        .prepare(
          `UPDATE profile_sync_state
           SET profile_dirty = 0, last_snapshot_at = ?
           WHERE id = 'singleton'`,
        )
        .run(currentTime);
    } catch (error) {
      requestContextWarn('Failed to refresh USER_CORE snapshot after profile mutation', error);
    }
  }

  function requestContextWarn(message: string, error: unknown): void {
    console.warn(
      `[profileRoutes] ${message}:`,
      error instanceof Error ? error.message : String(error),
    );
  }

  // -----------------------------------------------------------------------
  // GET /profile/items -- List user profile items with filters
  // -----------------------------------------------------------------------
  app.get<{
    Querystring: {
      type?: string;
      status?: string;
      key?: string;
      confirmed_only?: string;
      limit?: string;
      offset?: string;
    };
  }>('/profile/items', async (request, reply) => {
    const { db } = request.userContext;
    const { type, status, key, confirmed_only, limit: limitStr, offset: offsetStr } = request.query;
    const limit = Math.min(Math.max(parseInt(limitStr ?? '50', 10) || 50, 1), 200);
    const offset = Math.max(parseInt(offsetStr ?? '0', 10) || 0, 0);

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (type) {
      conditions.push('item_type = ?');
      params.push(type);
    }

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    } else {
      conditions.push("status IN ('active', 'pending_confirm')");
    }

    if (key) {
      conditions.push('item_key = ?');
      params.push(key);
    }

    if (confirmed_only === 'true' || confirmed_only === '1') {
      conditions.push('user_confirmed = 1');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) AS count FROM user_profile_items ${whereClause}`;
    const total = (db.prepare(countSql).get(...params) as CountRow).count;

    const dataSql = `
      SELECT * FROM user_profile_items
      ${whereClause}
      ORDER BY salience_score DESC, last_seen DESC
      LIMIT ? OFFSET ?
    `;
    const rows = db.prepare(dataSql).all(...params, limit, offset) as ProfileItemRow[];

    return reply.status(200).send({
      items: rows.map(formatProfileItem),
      total,
      limit,
      offset,
    });
  });

  // -----------------------------------------------------------------------
  // POST /profile/items -- Add a profile item (explicit entry by user)
  // -----------------------------------------------------------------------
  app.post<{ Body: CreateProfileItemBody }>(
    '/profile/items',
    { schema: { body: createProfileItemBodySchema } },
    async (request, reply) => {
      const { db } = request.userContext;
      const { itemType, itemKey, itemValue, evidenceRefs, confidence, validFrom, validTo } =
        request.body;

      const fingerprint = contentHash(itemKey + ':' + itemValue.toLowerCase().trim());
      const currentTime = now();
      const initialScore = confidence ?? 1.0;

      // Check for duplicate fingerprint among active items
      const existing = db
        .prepare("SELECT id FROM user_profile_items WHERE fingerprint = ? AND status = 'active'")
        .get(fingerprint) as { id: string } | undefined;

      if (existing) {
        return reply.status(409).send({
          error: 'A profile item with the same key and value already exists',
          existingId: existing.id,
        });
      }

      const id = v4();

      db.prepare(
        `INSERT INTO user_profile_items
          (id, item_type, item_key, item_value, evidence_refs, source_kind, confidence,
           user_confirmed, status, salience_score, mention_count, last_seen,
           valid_from, valid_to, created_at, updated_at, fingerprint)
         VALUES (?, ?, ?, ?, ?, 'explicit', ?, 1, 'active', ?, 1, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        itemType,
        itemKey,
        itemValue,
        evidenceRefs ? JSON.stringify(evidenceRefs) : null,
        initialScore,
        initialScore,
        currentTime,
        validFrom ?? null,
        validTo ?? null,
        currentTime,
        currentTime,
        fingerprint,
      );

      const row = db
        .prepare('SELECT * FROM user_profile_items WHERE id = ?')
        .get(id) as ProfileItemRow;

      await refreshUserCoreSnapshot(request.userContext);
      return reply.status(201).send(formatProfileItem(row));
    },
  );

  // -----------------------------------------------------------------------
  // PUT /profile/items/:id -- Update a profile item
  // -----------------------------------------------------------------------
  app.put<{ Params: { id: string }; Body: UpdateProfileItemBody }>(
    '/profile/items/:id',
    { schema: { body: updateProfileItemBodySchema } },
    async (request, reply) => {
      const { db } = request.userContext;
      const { id } = request.params;
      const body = request.body;

      const existing = db
        .prepare('SELECT * FROM user_profile_items WHERE id = ?')
        .get(id) as ProfileItemRow | undefined;

      if (!existing) {
        return reply.status(404).send({ error: 'Profile item not found' });
      }

      const currentTime = now();
      const updates: string[] = [];
      const params: unknown[] = [];

      if (body.itemValue !== undefined) {
        const newFingerprint = contentHash(existing.item_key + ':' + body.itemValue.toLowerCase().trim());
        const duplicate = db
          .prepare(
            `SELECT id FROM user_profile_items
             WHERE fingerprint = ?
               AND id != ?
               AND status IN ('active', 'pending_confirm')
             LIMIT 1`,
          )
          .get(newFingerprint, id) as { id: string } | undefined;

        if (duplicate) {
          return reply.status(409).send({
            error: 'A profile item with the same key and value already exists',
            existingId: duplicate.id,
          });
        }

        updates.push('item_value = ?');
        params.push(body.itemValue);
        updates.push('fingerprint = ?');
        params.push(newFingerprint);
      }
      if (body.confidence !== undefined) {
        updates.push('confidence = ?');
        params.push(body.confidence);
      }
      if (body.salienceScore !== undefined) {
        updates.push('salience_score = ?');
        params.push(body.salienceScore);
      }
      if (body.validFrom !== undefined) {
        updates.push('valid_from = ?');
        params.push(body.validFrom);
      }
      if (body.validTo !== undefined) {
        updates.push('valid_to = ?');
        params.push(body.validTo);
      }
      if (body.status !== undefined) {
        updates.push('status = ?');
        params.push(body.status);
      }

      if (updates.length === 0) {
        return reply.status(200).send(formatProfileItem(existing));
      }

      updates.push('updated_at = ?');
      params.push(currentTime);
      params.push(id);

      db.prepare(`UPDATE user_profile_items SET ${updates.join(', ')} WHERE id = ?`).run(...params);

      const row = db
        .prepare('SELECT * FROM user_profile_items WHERE id = ?')
        .get(id) as ProfileItemRow;

      await refreshUserCoreSnapshot(request.userContext);
      return reply.status(200).send(formatProfileItem(row));
    },
  );

  // -----------------------------------------------------------------------
  // DELETE /profile/items/:id -- Soft-delete (set status='retracted')
  // -----------------------------------------------------------------------
  app.delete<{ Params: { id: string } }>(
    '/profile/items/:id',
    async (request, reply) => {
      const { db } = request.userContext;
      const { id } = request.params;

      const existing = db
        .prepare('SELECT id FROM user_profile_items WHERE id = ?')
        .get(id) as { id: string } | undefined;

      if (!existing) {
        return reply.status(404).send({ error: 'Profile item not found' });
      }

      const currentTime = now();
      db.prepare(
        "UPDATE user_profile_items SET status = 'retracted', updated_at = ? WHERE id = ?",
      ).run(currentTime, id);

      await refreshUserCoreSnapshot(request.userContext);
      return reply.status(200).send({ id, deleted: true });
    },
  );

  // -----------------------------------------------------------------------
  // POST /profile/items/:id/confirm -- User confirms an inferred item
  // -----------------------------------------------------------------------
  app.post<{ Params: { id: string } }>(
    '/profile/items/:id/confirm',
    async (request, reply) => {
      const { db } = request.userContext;
      const { id } = request.params;

      const existing = db
        .prepare('SELECT * FROM user_profile_items WHERE id = ?')
        .get(id) as ProfileItemRow | undefined;

      if (!existing) {
        return reply.status(404).send({ error: 'Profile item not found' });
      }

      if (existing.user_confirmed === 1) {
        return reply.status(200).send({
          message: 'Already confirmed',
          item: formatProfileItem(existing),
        });
      }

      const currentTime = now();
      db.prepare(
        "UPDATE user_profile_items SET user_confirmed = 1, status = 'active', updated_at = ? WHERE id = ?",
      ).run(currentTime, id);

      const row = db
        .prepare('SELECT * FROM user_profile_items WHERE id = ?')
        .get(id) as ProfileItemRow;

      await refreshUserCoreSnapshot(request.userContext);
      return reply.status(200).send(formatProfileItem(row));
    },
  );

  // -----------------------------------------------------------------------
  // GET /profile/core -- Get USER_CORE.md content
  // -----------------------------------------------------------------------
  app.get('/profile/core', async (request, reply) => {
    const content = request.userContext.profileManager.renderUserCore(50);

    return reply.status(200).send({ content });
  });

  // -----------------------------------------------------------------------
  // GET /profile/social -- List social edges
  // -----------------------------------------------------------------------
  app.get<{
    Querystring: { limit?: string; offset?: string };
  }>('/profile/social', async (request, reply) => {
    const { db } = request.userContext;
    const { limit: limitStr, offset: offsetStr } = request.query;
    const limit = Math.min(Math.max(parseInt(limitStr ?? '50', 10) || 50, 1), 200);
    const offset = Math.max(parseInt(offsetStr ?? '0', 10) || 0, 0);

    const total = (
      db.prepare('SELECT COUNT(*) AS count FROM social_edges').get() as CountRow
    ).count;

    const rows = db
      .prepare(
        `SELECT * FROM social_edges
         ORDER BY strength DESC, created_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(limit, offset) as SocialEdgeRow[];

    return reply.status(200).send({
      items: rows.map(formatSocialEdge),
      total,
      limit,
      offset,
    });
  });

  // -----------------------------------------------------------------------
  // POST /profile/social -- Add a social edge
  // -----------------------------------------------------------------------
  app.post<{ Body: CreateSocialEdgeBody }>(
    '/profile/social',
    { schema: { body: createSocialEdgeBodySchema } },
    async (request, reply) => {
      const { db } = request.userContext;
      const {
        fromEntityId,
        toEntityId,
        relationType,
        strength,
        evidenceRefs,
        confidence,
        validFrom,
        validTo,
      } = request.body;

      const id = v4();
      const currentTime = now();

      db.prepare(
        `INSERT INTO social_edges
          (id, from_entity_id, to_entity_id, relation_type, strength, evidence_refs,
           confidence, user_confirmed, valid_from, valid_to, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      ).run(
        id,
        fromEntityId,
        toEntityId,
        relationType,
        strength ?? 0.5,
        evidenceRefs ? JSON.stringify(evidenceRefs) : null,
        confidence ?? 0.6,
        validFrom ?? null,
        validTo ?? null,
        currentTime,
        currentTime,
      );

      const row = db
        .prepare('SELECT * FROM social_edges WHERE id = ?')
        .get(id) as SocialEdgeRow;

      await refreshUserCoreSnapshot(request.userContext);
      return reply.status(201).send(formatSocialEdge(row));
    },
  );

  // -----------------------------------------------------------------------
  // GET /profile/opinions -- List opinion items
  // -----------------------------------------------------------------------
  app.get<{
    Querystring: { status?: string; dimension?: string; limit?: string; offset?: string };
  }>('/profile/opinions', async (request, reply) => {
    const { db } = request.userContext;
    const { status, dimension, limit: limitStr, offset: offsetStr } = request.query;
    const limit = Math.min(Math.max(parseInt(limitStr ?? '50', 10) || 50, 1), 200);
    const offset = Math.max(parseInt(offsetStr ?? '0', 10) || 0, 0);

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    if (dimension) {
      conditions.push('dimension = ?');
      params.push(dimension);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const total = (
      db.prepare(`SELECT COUNT(*) AS count FROM opinion_items ${whereClause}`).get(...params) as CountRow
    ).count;

    const rows = db
      .prepare(
        `SELECT * FROM opinion_items
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset) as OpinionItemRow[];

    return reply.status(200).send({
      items: rows.map(formatOpinionItem),
      total,
      limit,
      offset,
    });
  });

  // -----------------------------------------------------------------------
  // POST /profile/opinions/:id/confirm -- Confirm or reject an opinion
  // -----------------------------------------------------------------------
  app.post<{ Params: { id: string }; Body: ConfirmOpinionBody }>(
    '/profile/opinions/:id/confirm',
    { schema: { body: confirmOpinionBodySchema } },
    async (request, reply) => {
      const { db } = request.userContext;
      const { id } = request.params;
      const { action } = request.body;

      const existing = db
        .prepare('SELECT * FROM opinion_items WHERE id = ?')
        .get(id) as OpinionItemRow | undefined;

      if (!existing) {
        return reply.status(404).send({ error: 'Opinion item not found' });
      }

      const currentTime = now();

      if (action === 'accept') {
        db.prepare(
          "UPDATE opinion_items SET user_confirmed = 1, status = 'active', updated_at = ? WHERE id = ?",
        ).run(currentTime, id);
      } else {
        db.prepare(
          "UPDATE opinion_items SET status = 'retracted', updated_at = ? WHERE id = ?",
        ).run(currentTime, id);
      }

      const row = db
        .prepare('SELECT * FROM opinion_items WHERE id = ?')
        .get(id) as OpinionItemRow;

      return reply.status(200).send(formatOpinionItem(row));
    },
  );
}
