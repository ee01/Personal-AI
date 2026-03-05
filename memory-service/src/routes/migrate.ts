/**
 * Migration-specific routes for bulk data import.
 *
 * POST /migrate/entities       - Batch upsert entities (direct DB, no LLM)
 * POST /migrate/entity-properties - Batch insert entity properties
 */

import type { FastifyInstance } from 'fastify';
import { v4 } from 'uuid';

import { now } from '../utils/time.js';
import { toSlug } from '../utils/slug.js';

// ---------------------------------------------------------------------------
// Body types
// ---------------------------------------------------------------------------

interface MigrateEntityItem {
  name: string;
  type: string;
  description?: string;
  importance?: number;
  tags?: string[];
  aliases?: string[];
  status?: string;
  properties?: Record<string, string>;
  firstSeen?: number;
  lastSeen?: number;
}

interface MigrateEntitiesBody {
  items: MigrateEntityItem[];
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const migrateEntityItemSchema = {
  type: 'object' as const,
  required: ['name', 'type'],
  properties: {
    name: { type: 'string' as const, minLength: 1 },
    type: { type: 'string' as const },
    description: { type: 'string' as const },
    importance: { type: 'number' as const, minimum: 0, maximum: 1 },
    tags: { type: 'array' as const, items: { type: 'string' as const } },
    aliases: { type: 'array' as const, items: { type: 'string' as const } },
    status: { type: 'string' as const },
    properties: { type: 'object' as const, additionalProperties: { type: 'string' as const } },
    firstSeen: { type: 'number' as const },
    lastSeen: { type: 'number' as const },
  },
  additionalProperties: false,
};

const migrateEntitiesBodySchema = {
  type: 'object' as const,
  required: ['items'],
  properties: {
    items: {
      type: 'array' as const,
      items: migrateEntityItemSchema,
      minItems: 1,
      maxItems: 500,
    },
  },
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function migrateRoutes(
  app: FastifyInstance,
): Promise<void> {

  // -----------------------------------------------------------------------
  // POST /migrate/entities -- Batch upsert entities
  // -----------------------------------------------------------------------
  app.post<{ Body: MigrateEntitiesBody }>(
    '/migrate/entities',
    { schema: { body: migrateEntitiesBodySchema } },
    async (request, reply) => {
      const { db } = request.userContext;
      const { items } = request.body;
      const currentTime = now();

      const insertEntity = db.prepare(
        `INSERT INTO entities
          (id, type, name, aliases_json, description, importance,
           access_count, last_accessed, first_seen, last_seen,
           mention_count, tags_json, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 0, ?, ?, ?, ?)`,
      );

      const insertProperty = db.prepare(
        `INSERT INTO entity_properties
          (entity_id, property_key, property_value, value_type,
           source_authority, tx_start, confidence, is_final, status, action_type)
         VALUES (?, ?, ?, 'string', 'migration', ?, 0.8, 0, 'active', 'set')`,
      );

      const findByName = db.prepare(
        `SELECT id FROM entities WHERE name = ? AND type = ? LIMIT 1`,
      );

      let created = 0;
      let updated = 0;
      let errors = 0;
      const results: Array<{ name: string; id: string; status: string }> = [];

      const runBatch = db.transaction(() => {
        for (const item of items) {
          try {
            // Check if entity already exists
            const existing = findByName.get(item.name, item.type) as { id: string } | undefined;

            if (existing) {
              // Update existing entity
              const updates: string[] = [];
              const params: unknown[] = [];

              if (item.description) {
                updates.push('description = ?');
                params.push(item.description);
              }
              if (item.importance !== undefined) {
                updates.push('importance = CASE WHEN importance < ? THEN ? ELSE importance END');
                params.push(item.importance, item.importance);
              }
              if (item.tags?.length) {
                updates.push('tags_json = ?');
                params.push(JSON.stringify(item.tags));
              }
              if (item.aliases?.length) {
                updates.push('aliases_json = ?');
                params.push(JSON.stringify(item.aliases));
              }

              if (updates.length > 0) {
                updates.push('updated_at = ?');
                params.push(currentTime, existing.id);
                db.prepare(`UPDATE entities SET ${updates.join(', ')} WHERE id = ?`).run(...params);
              }

              // Insert properties
              if (item.properties) {
                for (const [key, value] of Object.entries(item.properties)) {
                  insertProperty.run(existing.id, key, value, currentTime);
                }
              }

              results.push({ name: item.name, id: existing.id, status: 'updated' });
              updated++;
            } else {
              // Create new entity
              const id = toSlug(item.type) + '-' + toSlug(item.name);

              insertEntity.run(
                id,
                item.type,
                item.name,
                item.aliases?.length ? JSON.stringify(item.aliases) : null,
                item.description ?? null,
                item.importance ?? 0.5,
                item.lastSeen ?? currentTime,
                item.firstSeen ?? currentTime,
                item.lastSeen ?? currentTime,
                item.tags?.length ? JSON.stringify(item.tags) : null,
                item.status ?? 'active',
                currentTime,
                currentTime,
              );

              // Insert properties
              if (item.properties) {
                for (const [key, value] of Object.entries(item.properties)) {
                  insertProperty.run(id, key, value, currentTime);
                }
              }

              results.push({ name: item.name, id, status: 'created' });
              created++;
            }
          } catch (err) {
            request.log.error(err, `Failed to migrate entity: ${item.name}`);
            results.push({ name: item.name, id: '', status: 'error' });
            errors++;
          }
        }
      });

      runBatch();

      return reply.status(200).send({
        results,
        totalCreated: created,
        totalUpdated: updated,
        totalError: errors,
      });
    },
  );
}
