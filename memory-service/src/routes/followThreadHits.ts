import { randomUUID } from 'node:crypto';

import type { FastifyInstance } from 'fastify';

interface FollowThreadHitRow {
  id: string;
  follow_item_id: string;
  post_id: string;
  sender: string;
  datetime: string;
  relation_type: string;
  summary: string | null;
  team_id: string | null;
  created_at: number;
  source_device: string | null;
}

interface FollowThreadHitResponse {
  id: string;
  followItemId: string;
  postId: string;
  sender: string;
  datetime: string;
  relationType: string;
  summary?: string;
  teamId?: string;
  createdAt: string;
  sourceDevice?: string;
}

interface PostFollowThreadHitBody {
  followItemId: string;
  postId: string;
  sender: string;
  datetime: string;
  relationType: string;
  summary?: string;
  teamId?: string;
  createdAt?: string;
  sourceDevice?: string;
}

interface GetFollowThreadHitsQuery {
  since?: string;
  followItemIds?: string;
  limit?: string;
}

function parseTimestampToMillis(value?: string): number | undefined {
  if (!value) return undefined;

  const numeric = Number(value);
  if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
    if (numeric > 0) return Math.floor(numeric);
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return undefined;
  return parsed;
}

function toHit(row: FollowThreadHitRow): FollowThreadHitResponse {
  return {
    id: row.id,
    followItemId: row.follow_item_id,
    postId: row.post_id,
    sender: row.sender,
    datetime: row.datetime,
    relationType: row.relation_type,
    summary: row.summary ?? undefined,
    teamId: row.team_id ?? undefined,
    createdAt: new Date(row.created_at).toISOString(),
    sourceDevice: row.source_device ?? undefined,
  };
}

const postFollowThreadHitBodySchema = {
  type: 'object' as const,
  required: ['followItemId', 'postId', 'sender', 'datetime', 'relationType'],
  properties: {
    followItemId: { type: 'string' as const, minLength: 1 },
    postId: { type: 'string' as const, minLength: 1 },
    sender: { type: 'string' as const, minLength: 1 },
    datetime: { type: 'string' as const, minLength: 1 },
    relationType: { type: 'string' as const, minLength: 1 },
    summary: { type: 'string' as const },
    teamId: { type: 'string' as const },
    createdAt: { type: 'string' as const, minLength: 1 },
    sourceDevice: { type: 'string' as const, minLength: 1 },
  },
  additionalProperties: false,
};

export async function followThreadHitRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: PostFollowThreadHitBody }>(
    '/follow-thread-hits',
    { schema: { body: postFollowThreadHitBodySchema } },
    async (request, reply) => {
      const { db } = request.userContext;
      const body = request.body;
      const createdAtMs = parseTimestampToMillis(body.createdAt) ?? Date.now();
      const id = randomUUID();

      const result = db.prepare(
        `INSERT INTO follow_thread_hits (
          id,
          follow_item_id,
          post_id,
          sender,
          datetime,
          relation_type,
          summary,
          team_id,
          created_at,
          source_device
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(follow_item_id, post_id) DO NOTHING`,
      ).run(
        id,
        body.followItemId,
        body.postId,
        body.sender,
        body.datetime,
        body.relationType,
        body.summary ?? null,
        body.teamId ?? null,
        createdAtMs,
        body.sourceDevice ?? null,
      );

      const row = db.prepare(
        `SELECT * FROM follow_thread_hits
         WHERE follow_item_id = ? AND post_id = ?`,
      ).get(
        body.followItemId,
        body.postId,
      ) as FollowThreadHitRow;

      return reply.status(200).send({
        status: result.changes > 0 ? 'created' : 'duplicate',
        hit: toHit(row),
      });
    },
  );

  app.get<{ Querystring: GetFollowThreadHitsQuery }>(
    '/follow-thread-hits',
    async (request, reply) => {
      const { db } = request.userContext;
      const limitRaw = Number(request.query.limit);
      const limit = Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(limitRaw, 1000)
        : 200;

      const conditions: string[] = [];
      const params: Array<string | number> = [];
      const since = parseTimestampToMillis(request.query.since);
      if (since !== undefined) {
        conditions.push('created_at > ?');
        params.push(since);
      }

      const followItemIds = request.query.followItemIds
        ?.split(',')
        .map((value) => value.trim())
        .filter(Boolean) ?? [];
      if (followItemIds.length > 0) {
        conditions.push(`follow_item_id IN (${followItemIds.map(() => '?').join(', ')})`);
        params.push(...followItemIds);
      }

      const whereClause = conditions.length > 0
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

      const rows = db.prepare(
        `SELECT * FROM follow_thread_hits
         ${whereClause}
         ORDER BY created_at ASC
         LIMIT ?`,
      ).all(...params, limit) as FollowThreadHitRow[];

      const items = rows.map(toHit);
      const nextSince = items.length > 0 ? items[items.length - 1].createdAt : request.query.since ?? null;

      return reply.status(200).send({
        items,
        total: items.length,
        nextSince,
      });
    },
  );
}
