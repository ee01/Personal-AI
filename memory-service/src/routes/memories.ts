import type { FastifyInstance } from 'fastify';
import type BetterSqlite3 from 'better-sqlite3';

import type { MemoryScope, RecallItem, RecallScope } from '../types/index.js';
import { buildExploreLink } from '../utils/exploreLink.js';
import { buildRecallPresentation } from '../utils/recallPresentation.js';

interface DeleteMemoriesQuerystring {
  source: string;
  scope?: RecallScope;
}

interface GetMemoryParams {
  type: 'message' | 'chunk';
  id: string;
}

const deleteMemoriesQuerystringSchema = {
  type: 'object' as const,
  required: ['source'],
  properties: {
    source: { type: 'string' as const, minLength: 1 },
    scope: {
      type: 'string' as const,
      enum: ['work', 'personal', 'both', 'all'],
    },
  },
  additionalProperties: false,
};

const getMemoryParamsSchema = {
  type: 'object' as const,
  required: ['type', 'id'],
  properties: {
    type: { type: 'string' as const, enum: ['message', 'chunk'] },
    id: { type: 'string' as const, minLength: 1 },
  },
  additionalProperties: false,
};

interface MessageMemoryRow {
  id: string;
  content: string;
  summary: string | null;
  scope: MemoryScope | null;
  source: string | null;
  source_type: string;
  source_url: string | null;
  source_title: string | null;
  sender: string | null;
  group_name: string | null;
  timestamp: number;
  metadata_json: string | null;
  importance: number | null;
}

interface ChunkMemoryRow {
  chunk_id: number;
  file_path: string;
  content: string;
  scope: MemoryScope | null;
  source: string | null;
  source_type: string | null;
  related_project: string | null;
  related_entity_id: string | null;
  created_at: number;
}

function buildScopePredicate(scope: RecallScope | undefined): {
  clause: string;
  params: string[];
} {
  if (!scope || scope === 'work') {
    return {
      clause: `AND COALESCE(scope, 'work') = ?`,
      params: ['work'],
    };
  }

  if (scope === 'personal') {
    return {
      clause: `AND COALESCE(scope, 'work') = ?`,
      params: ['personal'],
    };
  }

  return { clause: '', params: [] };
}

function normalizeStoredScope(scope: MemoryScope | null | undefined): MemoryScope {
  return scope === 'personal' ? 'personal' : 'work';
}

function parseMetadata(value: string | null): Record<string, any> | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : undefined;
  } catch {
    return undefined;
  }
}

function stripKnownChunkPathExtension(value: string): string {
  return value.replace(/\.(md|txt|json)$/i, '');
}

function getChunkMessageRefCandidates(chunk: ChunkMemoryRow): string[] {
  const candidates = new Set<string>();
  const add = (value: string | null | undefined): void => {
    const trimmed = value?.trim();
    if (trimmed) candidates.add(trimmed);
  };

  add(chunk.related_entity_id);

  const filePath = chunk.file_path.trim();
  if (filePath.startsWith('messages/')) {
    add(stripKnownChunkPathExtension(filePath.slice('messages/'.length)));
  }
  if (filePath.startsWith('calendar/')) {
    add(stripKnownChunkPathExtension(filePath.slice('calendar/'.length)));
  }

  return Array.from(candidates);
}

function buildMessageItem(row: MessageMemoryRow): RecallItem {
  const metadata = parseMetadata(row.metadata_json) || {};
  const scope = normalizeStoredScope(row.scope);
  const presentation = buildRecallPresentation({
    content: row.content,
    source: row.source_type,
    sourceTitle: row.source_title ?? undefined,
    presentationHint: 'compact',
    previewMaxLength: 180,
  });

  return {
    id: row.id,
    type: 'message',
    content: row.content,
    scope,
    displayTitle: presentation.displayTitle,
    displayText: presentation.displayText,
    previewText: presentation.previewText,
    score: row.importance ?? 1,
    source: row.source_type,
    sourceUrl: row.source_url ?? undefined,
    sourceTitle: row.source_title ?? undefined,
    exploreLink: buildExploreLink({ type: 'message', id: row.id }),
    timestamp: row.timestamp,
    metadata: {
      ...metadata,
      scope,
      source: row.source ?? row.source_type,
      sender: row.sender ?? metadata.sender,
      groupName: row.group_name ?? metadata.groupName,
      channels: ['direct'],
    },
  };
}

function buildChunkItem(
  chunk: ChunkMemoryRow,
  sourceMessage?: MessageMemoryRow,
): RecallItem {
  const scope = normalizeStoredScope(chunk.scope);
  const source = chunk.source_type ?? sourceMessage?.source_type;
  const sourceTitle = sourceMessage?.source_title ?? undefined;
  const sourceUrl = sourceMessage?.source_url ?? undefined;
  const presentation = buildRecallPresentation({
    content: chunk.content,
    source,
    sourceTitle,
    presentationHint: 'compact',
    previewMaxLength: 180,
  });

  return {
    id: String(chunk.chunk_id),
    type: 'chunk',
    content: chunk.content,
    scope,
    displayTitle: presentation.displayTitle,
    displayText: presentation.displayText,
    previewText: presentation.previewText,
    score: 1,
    source,
    sourceUrl,
    sourceTitle,
    exploreLink: buildExploreLink({ type: 'chunk', id: String(chunk.chunk_id) }),
    timestamp: chunk.created_at,
    metadata: {
      filePath: chunk.file_path,
      scope,
      source: chunk.source ?? source,
      relatedProject: chunk.related_project,
      relatedMessageId: sourceMessage?.id,
      channels: ['direct'],
    },
  };
}

function getMessageById(
  db: BetterSqlite3.Database,
  id: string,
): MessageMemoryRow | undefined {
  return db
    .prepare(
      `SELECT id, content, summary, scope, source, source_type,
              source_url, source_title, sender, group_name,
              timestamp, metadata_json, importance
       FROM messages_raw
       WHERE id = ?
       LIMIT 1`,
    )
    .get(id) as MessageMemoryRow | undefined;
}

function findChunkSourceMessage(
  db: BetterSqlite3.Database,
  chunk: ChunkMemoryRow,
): MessageMemoryRow | undefined {
  for (const messageId of getChunkMessageRefCandidates(chunk)) {
    const row = getMessageById(db, messageId);
    if (row) return row;
  }
  return undefined;
}

export async function memoryRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: GetMemoryParams }>(
    '/memories/:type/:id',
    {
      schema: {
        params: getMemoryParamsSchema,
      },
    },
    async (request, reply) => {
      const { db } = request.userContext;
      const { type, id } = request.params;

      if (type === 'message') {
        const row = getMessageById(db, id);

        if (!row) {
          return reply.status(404).send({ error: 'Memory not found' });
        }

        return reply.status(200).send(buildMessageItem(row));
      }

      const chunkId = Number(id);
      if (!Number.isInteger(chunkId)) {
        return reply.status(404).send({ error: 'Memory not found' });
      }

      const chunk = db
        .prepare(
          `SELECT chunk_id, file_path, content, scope, source, source_type,
                  related_project, related_entity_id, created_at
           FROM chunks
           WHERE chunk_id = ?`,
        )
        .get(chunkId) as ChunkMemoryRow | undefined;

      if (!chunk) {
        return reply.status(404).send({ error: 'Memory not found' });
      }

      const sourceMessage = findChunkSourceMessage(db, chunk);

      return reply.status(200).send(buildChunkItem(chunk, sourceMessage));
    },
  );

  app.delete<{ Querystring: DeleteMemoriesQuerystring }>(
    '/memories',
    {
      schema: {
        querystring: deleteMemoriesQuerystringSchema,
        response: {
          200: {
            type: 'object',
            properties: {
              source: { type: 'string' },
              scope: { type: 'string' },
              deletedMessages: { type: 'number' },
              deletedChunks: { type: 'number' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { db } = request.userContext;
      const source = request.query.source.trim();
      const scope = request.query.scope ?? 'work';
      const { clause: scopeClause, params: scopeParams } =
        buildScopePredicate(scope);

      const matchingMessages = db
        .prepare(
          `SELECT id
           FROM messages_raw
           WHERE source = ? ${scopeClause}`,
        )
        .all(source, ...scopeParams) as Array<{ id: string }>;
      const messageIds = matchingMessages.map((row) => row.id);

      const matchingChunks = db
        .prepare(
          `SELECT chunk_id
           FROM chunks
           WHERE source = ? ${scopeClause}`,
        )
        .all(source, ...scopeParams) as Array<{ chunk_id: number }>;
      const chunkIds = matchingChunks.map((row) => row.chunk_id);

      db.transaction(() => {
        if (chunkIds.length > 0) {
          const chunkPlaceholders = chunkIds
            .map(() => 'CAST(? AS INTEGER)')
            .join(', ');
          try {
            db.prepare(
              `DELETE FROM chunks_vec WHERE chunk_id IN (${chunkPlaceholders})`,
            ).run(...chunkIds);
          } catch {
            // sqlite-vec may be unavailable in some environments
          }
          db.prepare(
            `DELETE FROM chunks WHERE chunk_id IN (${chunkPlaceholders})`,
          ).run(...chunkIds);
          const chunkIdStrings = chunkIds.map(String);
          const metadataChunkPlaceholders = chunkIdStrings
            .map(() => '?')
            .join(', ');
          db.prepare(
            `DELETE FROM memory_metadata
             WHERE target_type = 'chunk' AND target_id IN (${metadataChunkPlaceholders})`,
          ).run(...chunkIdStrings);
        }

        if (messageIds.length > 0) {
          const messagePlaceholders = messageIds.map(() => '?').join(', ');
          try {
            db.prepare(
              `DELETE FROM messages_vec WHERE message_id IN (${messagePlaceholders})`,
            ).run(...messageIds);
          } catch {
            // sqlite-vec may be unavailable in some environments
          }
          db.prepare(
            `DELETE FROM messages_raw WHERE id IN (${messagePlaceholders})`,
          ).run(...messageIds);
          db.prepare(
            `DELETE FROM memory_metadata
             WHERE target_type = 'message' AND target_id IN (${messagePlaceholders})`,
          ).run(...messageIds);
        }
      })();

      return reply.status(200).send({
        source,
        scope,
        deletedMessages: messageIds.length,
        deletedChunks: chunkIds.length,
      });
    },
  );
}
