import type { FastifyInstance } from 'fastify';

import { now } from '../utils/time.js';

interface ConcernedItemsStateRow {
  singleton_id: number;
  items_json: string;
  version: number;
  updated_at: number;
  content_updated_at: number | null;
  updated_by_device: string | null;
}

interface ConcernedItemsSnapshotResponse {
  items: unknown[];
  version: number;
  updatedAt: string | null;
  contentUpdatedAt: string | null;
  updatedByDevice?: string;
}

interface PutConcernedItemsBody {
  items: unknown[];
  baseVersion?: number;
  contentUpdatedAt?: string;
  updatedByDevice?: string;
}

function safeParseItems(value: string | null | undefined): unknown[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toIso(value: number | null | undefined, multiplier = 1): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return new Date(value * multiplier).toISOString();
}

function parseContentUpdatedAt(value?: string): number | null {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toSnapshot(row?: ConcernedItemsStateRow): ConcernedItemsSnapshotResponse {
  if (!row) {
    return {
      items: [],
      version: 0,
      updatedAt: null,
      contentUpdatedAt: null,
    };
  }

  return {
    items: safeParseItems(row.items_json),
    version: row.version,
    updatedAt: toIso(row.updated_at, 1000),
    contentUpdatedAt: toIso(row.content_updated_at),
    updatedByDevice: row.updated_by_device ?? undefined,
  };
}

const putConcernedItemsBodySchema = {
  type: 'object' as const,
  required: ['items'],
  properties: {
    items: { type: 'array' as const, items: {} },
    baseVersion: { type: 'number' as const, minimum: 0 },
    contentUpdatedAt: { type: 'string' as const, minLength: 1 },
    updatedByDevice: { type: 'string' as const, minLength: 1 },
  },
  additionalProperties: false,
};

export async function concernedItemsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/concerned-items', async (request, reply) => {
    const { db } = request.userContext;
    const row = db
      .prepare('SELECT * FROM concerned_items_state WHERE singleton_id = 1')
      .get() as ConcernedItemsStateRow | undefined;

    return reply.status(200).send(toSnapshot(row));
  });

  app.put<{ Body: PutConcernedItemsBody }>(
    '/concerned-items',
    { schema: { body: putConcernedItemsBodySchema } },
    async (request, reply) => {
      const { db } = request.userContext;
      const { items, updatedByDevice } = request.body;
      const currentRow = db
        .prepare('SELECT * FROM concerned_items_state WHERE singleton_id = 1')
        .get() as ConcernedItemsStateRow | undefined;
      const currentSnapshot = toSnapshot(currentRow);
      const baseVersion = request.body.baseVersion ?? 0;
      const incomingContentUpdatedAt = parseContentUpdatedAt(request.body.contentUpdatedAt) ?? Date.now();
      const currentContentUpdatedAt = parseContentUpdatedAt(currentSnapshot.contentUpdatedAt ?? undefined);

      if (
        currentSnapshot.version !== baseVersion
        && currentContentUpdatedAt !== null
        && incomingContentUpdatedAt <= currentContentUpdatedAt
      ) {
        return reply.status(409).send({
          error: 'Concerned items snapshot version conflict',
          current: currentSnapshot,
        });
      }

      const updatedAt = now();
      const nextVersion = currentSnapshot.version + 1;
      const itemsJson = JSON.stringify(items);

      if (currentRow) {
        db.prepare(
          `UPDATE concerned_items_state
           SET items_json = ?, version = ?, updated_at = ?, content_updated_at = ?, updated_by_device = ?
           WHERE singleton_id = 1`,
        ).run(
          itemsJson,
          nextVersion,
          updatedAt,
          incomingContentUpdatedAt,
          updatedByDevice ?? null,
        );
      } else {
        db.prepare(
          `INSERT INTO concerned_items_state (
            singleton_id,
            items_json,
            version,
            updated_at,
            content_updated_at,
            updated_by_device
          ) VALUES (1, ?, ?, ?, ?, ?)`,
        ).run(
          itemsJson,
          nextVersion,
          updatedAt,
          incomingContentUpdatedAt,
          updatedByDevice ?? null,
        );
      }

      return reply.status(200).send({
        items,
        version: nextVersion,
        updatedAt: toIso(updatedAt, 1000),
        contentUpdatedAt: toIso(incomingContentUpdatedAt),
        updatedByDevice,
      });
    },
  );
}
