/**
 * Entity CRUD API routes.
 *
 * GET /entities           - List entities with filters
 * GET /entities/:id       - Get entity detail with current active properties
 * GET /entities/:id/properties   - Get property history
 * GET /entities/:id/timeline     - Get property change timeline
 * GET /entities/:id/relationships - Get entity relationships
 */

import type { FastifyInstance } from 'fastify';

import { TruthMaintainer } from '../core/TruthMaintainer.js';

// ---------------------------------------------------------------------------
// Row interfaces
// ---------------------------------------------------------------------------

interface EntityRow {
  id: string;
  type: string;
  name: string;
  aliases_json: string | null;
  description: string | null;
  importance: number;
  access_count: number;
  last_accessed: number | null;
  first_seen: number | null;
  last_seen: number | null;
  mention_count: number;
  tags_json: string | null;
  markdown_path: string | null;
  status: string;
  merged_into: string | null;
  created_at: number;
  updated_at: number | null;
}

interface PropertyRow {
  id: number;
  entity_id: string;
  property_key: string;
  property_value: string;
  value_type: string;
  source_message_id: string | null;
  source_author: string | null;
  source_authority: string | null;
  source_context: string | null;
  valid_from: number | null;
  valid_to: number | null;
  tx_start: number;
  tx_end: number | null;
  confidence: number;
  superseded_by: number | null;
  supersede_reason: string | null;
  is_final: number;
  status: string;
  action_type: string | null;
}

interface RelationshipRow {
  id: number;
  from_entity_id: string;
  to_entity_id: string;
  relation_type: string;
  strength: number;
  co_occurrence_count: number;
  evidence_message_ids_json: string | null;
  context: string | null;
  valid_from: number | null;
  valid_to: number | null;
  created_at: number;
  updated_at: number | null;
  // Joined entity fields
  entity_name?: string;
  entity_type?: string;
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

function formatEntity(row: EntityRow) {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    aliases: safeJsonParse<string[]>(row.aliases_json, []),
    description: row.description,
    importance: row.importance,
    accessCount: row.access_count,
    lastAccessed: row.last_accessed,
    firstSeen: row.first_seen,
    lastSeen: row.last_seen,
    mentionCount: row.mention_count,
    tags: safeJsonParse<string[]>(row.tags_json, []),
    markdownPath: row.markdown_path,
    status: row.status,
    mergedInto: row.merged_into,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function formatProperty(row: PropertyRow) {
  return {
    id: row.id,
    entityId: row.entity_id,
    propertyKey: row.property_key,
    propertyValue: row.property_value,
    valueType: row.value_type,
    sourceMessageId: row.source_message_id,
    sourceAuthor: row.source_author,
    sourceAuthority: row.source_authority,
    sourceContext: row.source_context,
    validFrom: row.valid_from,
    validTo: row.valid_to,
    txStart: row.tx_start,
    txEnd: row.tx_end,
    confidence: row.confidence,
    supersededBy: row.superseded_by,
    supersedeReason: row.supersede_reason,
    isFinal: !!row.is_final,
    status: row.status,
    actionType: row.action_type,
  };
}

function formatRelationship(row: RelationshipRow) {
  return {
    id: row.id,
    fromEntityId: row.from_entity_id,
    toEntityId: row.to_entity_id,
    relationType: row.relation_type,
    strength: row.strength,
    coOccurrenceCount: row.co_occurrence_count,
    evidenceMessageIds: safeJsonParse<string[]>(row.evidence_message_ids_json, []),
    context: row.context,
    validFrom: row.valid_from,
    validTo: row.valid_to,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    entityName: row.entity_name,
    entityType: row.entity_type,
  };
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function entityRoutes(
  app: FastifyInstance,
): Promise<void> {
  // -----------------------------------------------------------------------
  // GET /entities — List entities with filters
  // -----------------------------------------------------------------------
  app.get<{
    Querystring: {
      type?: string;
      search?: string;
      status?: string;
      limit?: string;
      offset?: string;
    };
  }>('/entities', async (request, reply) => {
    const { db } = request.userContext;
    const { type, search, status, limit: limitStr, offset: offsetStr } = request.query;
    const limit = Math.min(Math.max(parseInt(limitStr ?? '50', 10) || 50, 1), 200);
    const offset = Math.max(parseInt(offsetStr ?? '0', 10) || 0, 0);

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (type) {
      conditions.push('type = ?');
      params.push(type);
    }

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    } else {
      // Default: only active entities
      conditions.push("status = 'active'");
    }

    if (search) {
      conditions.push('(name LIKE ? OR description LIKE ?)');
      const pattern = `%${search}%`;
      params.push(pattern, pattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) AS count FROM entities ${whereClause}`;
    const total = (db.prepare(countSql).get(...params) as CountRow).count;

    const dataSql = `
      SELECT * FROM entities
      ${whereClause}
      ORDER BY importance DESC, last_seen DESC
      LIMIT ? OFFSET ?
    `;
    const rows = db.prepare(dataSql).all(...params, limit, offset) as EntityRow[];

    return reply.status(200).send({
      items: rows.map(formatEntity),
      total,
      limit,
      offset,
    });
  });

  // -----------------------------------------------------------------------
  // GET /entities/:id — Get entity detail with current active properties
  // -----------------------------------------------------------------------
  app.get<{
    Params: { id: string };
  }>('/entities/:id', async (request, reply) => {
    const { db } = request.userContext;
    const { id } = request.params;

    const entity = db.prepare('SELECT * FROM entities WHERE id = ?').get(id) as
      | EntityRow
      | undefined;

    if (!entity) {
      return reply.status(404).send({ error: 'Entity not found' });
    }

    // Fetch all current active properties
    const properties = db
      .prepare(
        `SELECT * FROM entity_properties
         WHERE entity_id = ? AND status = 'active' AND tx_end IS NULL
         ORDER BY property_key ASC`,
      )
      .all(id) as PropertyRow[];

    return reply.status(200).send({
      ...formatEntity(entity),
      properties: properties.map(formatProperty),
    });
  });

  // -----------------------------------------------------------------------
  // GET /entities/:id/properties — Get property history
  // -----------------------------------------------------------------------
  app.get<{
    Params: { id: string };
    Querystring: { key?: string; includeSuperseded?: string };
  }>('/entities/:id/properties', async (request, reply) => {
    const { db } = request.userContext;
    const truthMaintainer = new TruthMaintainer(db);
    const { id } = request.params;
    const { key, includeSuperseded } = request.query;

    // Verify entity exists
    const entity = db.prepare('SELECT id FROM entities WHERE id = ?').get(id) as
      | { id: string }
      | undefined;

    if (!entity) {
      return reply.status(404).send({ error: 'Entity not found' });
    }

    const showAll = includeSuperseded === 'true' || includeSuperseded === '1';

    let rows: PropertyRow[];
    if (showAll) {
      rows = truthMaintainer.getPropertyHistory(id, key ?? undefined);
    } else {
      // Only active properties
      if (key) {
        const prop = truthMaintainer.getActiveProperty(id, key);
        rows = prop ? [prop as unknown as PropertyRow] : [];
      } else {
        rows = db
          .prepare(
            `SELECT * FROM entity_properties
             WHERE entity_id = ? AND status = 'active' AND tx_end IS NULL
             ORDER BY property_key ASC`,
          )
          .all(id) as PropertyRow[];
      }
    }

    return reply.status(200).send({
      entityId: id,
      properties: rows.map(formatProperty),
      total: rows.length,
    });
  });

  // -----------------------------------------------------------------------
  // GET /entities/:id/timeline — Get property change timeline
  // -----------------------------------------------------------------------
  app.get<{
    Params: { id: string };
  }>('/entities/:id/timeline', async (request, reply) => {
    const { db } = request.userContext;
    const truthMaintainer = new TruthMaintainer(db);
    const { id } = request.params;

    // Verify entity exists
    const entity = db.prepare('SELECT id FROM entities WHERE id = ?').get(id) as
      | { id: string }
      | undefined;

    if (!entity) {
      return reply.status(404).send({ error: 'Entity not found' });
    }

    const timeline = truthMaintainer.getEntityTimeline(id);

    return reply.status(200).send({
      entityId: id,
      timeline,
      total: timeline.length,
    });
  });

  // -----------------------------------------------------------------------
  // GET /entities/:id/relationships — Get entity relationships
  // -----------------------------------------------------------------------
  app.get<{
    Params: { id: string };
    Querystring: { depth?: string };
  }>('/entities/:id/relationships', async (request, reply) => {
    const { db } = request.userContext;
    const { id } = request.params;
    const depth = Math.min(Math.max(parseInt(request.query.depth ?? '1', 10) || 1, 1), 3);

    // Verify entity exists
    const entity = db.prepare('SELECT id FROM entities WHERE id = ?').get(id) as
      | { id: string }
      | undefined;

    if (!entity) {
      return reply.status(404).send({ error: 'Entity not found' });
    }

    // Collect relationships breadth-first up to requested depth
    const visited = new Set<string>([id]);
    let frontier = [id];
    const allRelationships: ReturnType<typeof formatRelationship>[] = [];

    for (let d = 0; d < depth; d++) {
      if (frontier.length === 0) break;

      const placeholders = frontier.map(() => '?').join(',');

      // Outgoing relationships
      const outgoing = db
        .prepare(
          `SELECT r.*, e.name AS entity_name, e.type AS entity_type
           FROM relationships r
           JOIN entities e ON e.id = r.to_entity_id
           WHERE r.from_entity_id IN (${placeholders})`,
        )
        .all(...frontier) as RelationshipRow[];

      // Incoming relationships
      const incoming = db
        .prepare(
          `SELECT r.*, e.name AS entity_name, e.type AS entity_type
           FROM relationships r
           JOIN entities e ON e.id = r.from_entity_id
           WHERE r.to_entity_id IN (${placeholders})`,
        )
        .all(...frontier) as RelationshipRow[];

      const nextFrontier: string[] = [];

      for (const row of outgoing) {
        allRelationships.push(formatRelationship(row));
        if (!visited.has(row.to_entity_id)) {
          visited.add(row.to_entity_id);
          nextFrontier.push(row.to_entity_id);
        }
      }

      for (const row of incoming) {
        allRelationships.push(formatRelationship(row));
        if (!visited.has(row.from_entity_id)) {
          visited.add(row.from_entity_id);
          nextFrontier.push(row.from_entity_id);
        }
      }

      frontier = nextFrontier;
    }

    return reply.status(200).send({
      entityId: id,
      relationships: allRelationships,
      depth,
      total: allRelationships.length,
    });
  });
}
