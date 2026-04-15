/**
 * Context Match route — finds reflection threads / reflections / dreams
 * relevant to the current browsing context.
 *
 * POST /context-match
 * Body: { title, keywords?, snippet? }
 * Returns: { match: { content, source, score } | null }
 */

import type { FastifyInstance } from 'fastify';
import { EmbeddingClient } from '../llm/EmbeddingClient.js';
import { getConfig } from '../config.js';
import { buildRecallPresentation } from '../utils/recallPresentation.js';

interface ContextMatchBody {
  title: string;
  keywords?: string | string[];
  snippet?: string;
  presentationHint?: 'default' | 'compact' | 'meeting_pilot';
  previewMaxLength?: number;
}

interface ChunkRow {
  chunk_id: number;
  content: string;
  file_path: string;
}

export async function contextMatchRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: ContextMatchBody }>(
    '/context-match',
    async (request, reply) => {
      try {
        const {
          title,
          keywords,
          snippet,
          presentationHint,
          previewMaxLength,
        } = request.body ?? {};

        if (!title) {
          return reply.send({ match: null });
        }

        // Build query text from available fields
        const parts = [title];
        const kw = Array.isArray(keywords) ? keywords.join(' ') : (keywords ?? '');
        if (kw) parts.push(kw);
        if (snippet) parts.push(snippet);
        const queryText = parts.join(' ').slice(0, 1000);

        // Generate embedding
        const embeddingClient = await EmbeddingClient.getInstance();
        const embedding = await embeddingClient.embed(queryText);
        const embJson = JSON.stringify(embedding);

        const db = request.userContext.db;
        const config = getConfig();

        // Vector search on chunks_vec (same pattern as RecallEngine)
        const vecRows = db
          .prepare(
            `SELECT chunk_id, distance
             FROM chunks_vec
             WHERE embedding MATCH ?
             ORDER BY distance
             LIMIT 20`,
          )
          .all(embJson) as Array<{ chunk_id: number; distance: number }>;

        if (vecRows.length === 0) {
          return reply.send({ match: null });
        }

        // Load chunk content and filter to reflection-like artifacts only
        const chunkIds = vecRows.map((r) => r.chunk_id);
        const ph = chunkIds.map(() => '?').join(', ');
        const chunks = db
          .prepare(
            `SELECT chunk_id, content, file_path
             FROM chunks
             WHERE chunk_id IN (${ph})`,
          )
          .all(...chunkIds) as ChunkRow[];

        const chunkMap = new Map(chunks.map((c) => [c.chunk_id, c]));

        // Find best match from reflection threads / reflections / dreams paths
        let bestMatch:
          | {
              content: string;
              source: string;
              score: number;
              displayTitle?: string;
              displayText: string;
              previewText: string;
            }
          | null = null;

        for (const row of vecRows) {
          const chunk = chunkMap.get(row.chunk_id);
          if (!chunk) continue;

          const fp = chunk.file_path.toLowerCase();
          const isReflectionLike =
            fp.includes('reflection-threads/') ||
            fp.includes('reflections/') ||
            fp.includes('dreams/');
          if (!isReflectionLike) continue;

          const score = 1 / (1 + row.distance);
          if (score < config.contextMatchThreshold) continue;

          if (!bestMatch || score > bestMatch.score) {
            const presentation = buildRecallPresentation({
              content: chunk.content,
              query: queryText,
              source: chunk.file_path,
              presentationHint,
              previewMaxLength,
            });
            bestMatch = {
              content: chunk.content,
              source: chunk.file_path,
              score,
              displayTitle: presentation.displayTitle,
              displayText: presentation.displayText,
              previewText: presentation.previewText,
            };
          }
        }

        return reply.send({ match: bestMatch });
      } catch (err) {
        console.warn('[contextMatch] Error:', err);
        return reply.send({ match: null });
      }
    },
  );
}
